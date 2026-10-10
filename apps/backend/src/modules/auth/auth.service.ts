import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
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
import { claimInvite, hashInviteCode } from "../../common/invite-code.js";
import { ageRequired, checkAge } from "../../common/age.js";

const BCRYPT_ROUNDS = 10;
// Compared against when the email is unknown, so every failed login takes the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);
// Per-email lockout, on top of the per-IP rate limit (in memory: one API instance).
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

/** bcrypt only reads the first 72 bytes, so a longer password would be silently cut. */
function checkPasswordLength(password: string) {
  if (Buffer.byteLength(password, "utf8") > 72) throw new BadRequestException("Please use a password of 72 characters or fewer");
}

export interface AuthResult {
  token: string;
  userId: string;
  householdId: string;
  /** True until the person finishes profile setup — the app sends them there first. */
  needsProfile: boolean;
  /** Accounts from before the age check confirm their date of birth first. */
  needsAgeConfirmation: boolean;
}

interface NewAccount {
  email: string;
  passwordHash: string | null;
  birthYear: number;
  name: string;
  inviteCode?: string | undefined;
  householdName?: string | undefined;
  defaultServings?: number | undefined;
}

@Injectable()
export class AuthService {
  private readonly failedLogins = new Map<string, { count: number; until: number }>();

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
    const [member, user] = await Promise.all([
      this.prisma.householdMember.findUnique({ where: { userId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    const token = await this.createSession(userId);
    return { token, userId, householdId, needsProfile: !member?.profileCompletedAt, needsAgeConfirmation: !user.ageConfirmedAt };
  }

  private findUserByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  }

  /** Joins the inviting household as a member, or owns a new one. */
  private async createAccount(tx: Prisma.TransactionClient, account: NewAccount) {
    let householdId: string;
    let role: MemberRole = MemberRole.owner;

    if (account.inviteCode) {
      householdId = (await claimInvite(tx, account.inviteCode)).householdId;
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
      data: { email: account.email, passwordHash: account.passwordHash, householdId, birthYear: account.birthYear, ageConfirmedAt: new Date() },
    });
    await tx.householdMember.create({ data: { name: account.name, householdId, userId: user.id, role } });
    if (account.inviteCode) {
      await tx.householdInvite.update({ where: { codeHash: hashInviteCode(account.inviteCode) }, data: { acceptedByUserId: user.id } });
    }
    return user;
  }

  async signup(dto: SignupDto): Promise<AuthResult> {
    // Under 16: refused before anything is stored.
    const birthYear = checkAge(dto.dateOfBirth);
    checkPasswordLength(dto.password);
    const email = dto.email.toLowerCase();
    if (await this.findUserByEmail(email)) throw new ConflictException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction((tx) =>
      this.createAccount(tx, {
        email,
        passwordHash,
        birthYear,
        name: email.split("@")[0]!,
        inviteCode: dto.inviteCode,
        householdName: dto.householdName,
        defaultServings: dto.defaultServings,
      }),
    );
    return this.result(user.id, user.householdId);
  }

  /** Same answer, and the same time, whether or not the email exists. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const key = dto.email.toLowerCase();
    const failed = this.failedLogins.get(key);
    if (failed && failed.count >= MAX_FAILED_LOGINS && failed.until > Date.now()) {
      throw new HttpException("Too many attempts. Try again in a few minutes.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.findUserByEmail(dto.email);
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !valid) {
      const count = failed && failed.until > Date.now() ? failed.count + 1 : 1;
      if (this.failedLogins.size > 10_000) {
        for (const [email, entry] of this.failedLogins) if (entry.until <= Date.now()) this.failedLogins.delete(email);
      }
      this.failedLogins.set(key, { count, until: Date.now() + LOCKOUT_MS });
      throw new UnauthorizedException("Invalid email or password");
    }

    this.failedLogins.delete(key);
    return this.result(user.id, user.householdId);
  }

  async logout(household: RequestHousehold) {
    await this.prisma.session.delete({ where: { id: household.sessionId } });
    return { signedOut: true };
  }

  /** Every session on every device, this one included. */
  async logoutEverywhere(household: RequestHousehold) {
    await this.prisma.session.deleteMany({ where: { userId: household.userId } });
    return { signedOut: true };
  }

  /** Linked → sign in; same verified email → link; otherwise create. Unverified emails never link. */
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

    let user = await this.findUserByEmail(identity.email);
    if (!user) {
      // A new account needs a date of birth first; nothing is stored until it's given.
      if (!dto.dateOfBirth) throw ageRequired();
      const birthYear = checkAge(dto.dateOfBirth);
      user = await this.prisma.$transaction((tx) =>
        this.createAccount(tx, {
          email: identity.email!,
          passwordHash: null,
          birthYear,
          name: dto.name?.trim() || identity.name || identity.email!.split("@")[0]!,
          inviteCode: dto.inviteCode,
        }),
      );
    }
    await this.prisma.oAuthAccount.create({
      data: { provider: identity.provider, subject: identity.subject, email: identity.email, userId: user.id },
    });
    return this.result(user.id, user.householdId);
  }

  /** Owner only. Replaces the household's preferences. */
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

