import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { MemberRole, PreferenceType, type Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma.service.js";
import { generateSessionToken, hashSessionToken, SESSION_TTL_MS } from "../../common/session.js";
import type { RequestHousehold } from "../../common/household-context.js";
import type { SignupDto } from "./dto/signup.dto.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { OnboardingDto } from "./dto/onboarding.dto.js";
import type { OAuthDto } from "./dto/oauth.dto.js";
import { OAuthVerifier } from "./oauth-verifier.js";
import { hashInviteCode } from "../../common/invite-code.js";

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  userId: string;
  householdId: string;
  /** True until the person finishes profile setup — the app sends them there first. */
  needsProfile: boolean;
}

interface NewAccount {
  email: string;
  passwordHash: string | null;
  name: string;
  inviteCode?: string | undefined;
  householdName?: string | undefined;
  defaultServings?: number | undefined;
}

/** Session-based, household-scoped auth — see docs/architecture.md "Cross-cutting". */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthVerifier: OAuthVerifier,
  ) {}

  private async createSession(userId: string): Promise<string> {
    const token = generateSessionToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  private async result(userId: string, householdId: string): Promise<AuthResult> {
    const member = await this.prisma.householdMember.findUnique({ where: { userId } });
    const token = await this.createSession(userId);
    return { token, userId, householdId, needsProfile: !member?.profileCompletedAt };
  }

  private findUserByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  }

  /**
   * A new user either joins the household that invited them (as a member) or gets a
   * household of their own (as its owner). Either way they get a HouseholdMember row —
   * that's who appears on the housemates screen and in the cost split.
   */
  private async createAccount(tx: Prisma.TransactionClient, account: NewAccount) {
    let householdId: string;
    let role: MemberRole = MemberRole.owner;

    if (account.inviteCode) {
      const invite = await tx.householdInvite.findUnique({ where: { codeHash: hashInviteCode(account.inviteCode) } });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new BadRequestException("That invite code isn't valid any more — ask for a new one");
      }
      householdId = invite.householdId;
      role = MemberRole.member;
    } else {
      const household = await tx.household.create({
        data: {
          name: account.householdName ?? `${account.name}'s household`,
          weeklyBudgetCents: 0,
          defaultServings: account.defaultServings ?? 2,
        },
      });
      householdId = household.id;
    }

    const user = await tx.user.create({
      data: { email: account.email, passwordHash: account.passwordHash, householdId },
    });
    await tx.householdMember.create({ data: { name: account.name, householdId, userId: user.id, role } });
    if (account.inviteCode) {
      await tx.householdInvite.update({
        where: { codeHash: hashInviteCode(account.inviteCode) },
        data: { acceptedAt: new Date(), acceptedByUserId: user.id },
      });
    }
    return user;
  }

  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    if (await this.findUserByEmail(email)) throw new ConflictException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction((tx) =>
      this.createAccount(tx, {
        email,
        passwordHash,
        name: email.split("@")[0]!,
        inviteCode: dto.inviteCode,
        householdName: dto.householdName,
        defaultServings: dto.defaultServings,
      }),
    );
    return this.result(user.id, user.householdId);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.findUserByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Invalid email or password");
    if (!user.passwordHash) {
      throw new UnauthorizedException("This account signs in with Google or Apple — use that button instead");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    return this.result(user.id, user.householdId);
  }

  /**
   * Google or Apple sign-in. Already linked → sign in. Same verified email as an
   * existing account → link it and sign in (the provider has proved the person owns
   * that address). Otherwise → new account, joining the invite's household if a valid
   * code came with it. Unverified emails never link, or anyone could claim an account
   * by creating a provider login with someone else's address.
   */
  async oauth(dto: OAuthDto): Promise<AuthResult> {
    const identity = await this.oauthVerifier.verify(dto.provider, dto.idToken);

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
      include: { user: true },
    });
    if (linked) return this.result(linked.user.id, linked.user.householdId);

    if (!identity.email) throw new BadRequestException("We need an email address from your account to sign you in");
    if (!identity.emailVerified) {
      throw new UnauthorizedException("Please verify your email with your provider first, then try again");
    }

    const existing = await this.findUserByEmail(identity.email);
    const user =
      existing ??
      (await this.prisma.$transaction((tx) =>
        this.createAccount(tx, {
          email: identity.email!,
          passwordHash: null,
          name: dto.name?.trim() || identity.name || identity.email!.split("@")[0]!,
          inviteCode: dto.inviteCode,
        }),
      ));
    await this.prisma.oAuthAccount.create({
      data: { provider: identity.provider, subject: identity.subject, email: identity.email, userId: user.id },
    });
    return this.result(user.id, user.householdId);
  }

  /**
   * Replaces the household's preference set with the submitted onboarding answers.
   * Idempotent by design — re-running onboarding (e.g. editing preferences later from
   * Profile) fully replaces the previous answers rather than accumulating duplicates.
   */
  async onboard(household: RequestHousehold, dto: OnboardingDto) {
    const me = await this.prisma.householdMember.findUnique({ where: { userId: household.userId } });
    if (me?.role !== MemberRole.owner) {
      throw new ForbiddenException("Only the household owner can change the household's preferences");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.household.update({
        where: { id: household.householdId },
        data: {
          ...(dto.weeklyBudgetCents !== undefined ? { weeklyBudgetCents: dto.weeklyBudgetCents } : {}),
          ...(dto.budgetTier !== undefined ? { budgetTier: dto.budgetTier } : {}),
          ...(dto.householdName !== undefined ? { name: dto.householdName } : {}),
          ...(dto.defaultServings !== undefined ? { defaultServings: dto.defaultServings } : {}),
        },
      });

      await tx.preference.deleteMany({ where: { householdId: household.householdId } });

      const rows: Array<{ type: PreferenceType; value: string }> = [
        ...dto.cuisineLikes.map((value) => ({ type: PreferenceType.cuisine_like, value })),
        ...dto.dislikes.map((value) => ({ type: PreferenceType.dislike, value })),
        ...dto.allergies.map((value) => ({ type: PreferenceType.allergy, value })),
        ...dto.diets.map((value) => ({ type: PreferenceType.diet, value })),
        ...dto.busyDays.map((value) => ({ type: PreferenceType.busy_day, value })),
        ...dto.eatOutDays.map((value) => ({ type: PreferenceType.eat_out_day, value })),
        ...(dto.skill ? [{ type: PreferenceType.skill, value: dto.skill }] : []),
        ...(dto.maxCookMinutes !== undefined
          ? [{ type: PreferenceType.max_cook_minutes, value: String(dto.maxCookMinutes) }]
          : []),
        ...(dto.leftoverTolerance !== undefined
          ? [{ type: PreferenceType.leftover_tolerance, value: String(dto.leftoverTolerance) }]
          : []),
      ];

      if (rows.length > 0) {
        await tx.preference.createMany({
          data: rows.map((row) => ({ ...row, householdId: household.householdId })),
        });
      }
    });

    return this.prisma.household.findUniqueOrThrow({
      where: { id: household.householdId },
      include: { preferences: true },
    });
  }
}
