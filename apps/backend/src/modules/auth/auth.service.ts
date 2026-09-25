import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PreferenceType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma.service.js";
import { generateSessionToken, hashSessionToken, SESSION_TTL_MS } from "../../common/session.js";
import type { RequestHousehold } from "../../common/household-context.js";
import type { SignupDto } from "./dto/signup.dto.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { OnboardingDto } from "./dto/onboarding.dto.js";

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  userId: string;
  householdId: string;
}

/** Session-based, household-scoped auth — see docs/architecture.md "Cross-cutting". */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const household = await this.prisma.household.create({
      data: {
        name: dto.householdName,
        weeklyBudgetCents: 0,
        defaultServings: dto.defaultServings ?? 2,
      },
    });

    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, householdId: household.id },
    });

    const token = await this.createSession(user.id);
    return { token, userId: user.id, householdId: household.id };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("Invalid email or password");

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    const token = await this.createSession(user.id);
    return { token, userId: user.id, householdId: user.householdId };
  }

  /**
   * Replaces the household's preference set with the submitted onboarding answers.
   * Idempotent by design — re-running onboarding (e.g. editing preferences later from
   * Profile) fully replaces the previous answers rather than accumulating duplicates.
   */
  async onboard(household: RequestHousehold, dto: OnboardingDto) {
    await this.prisma.$transaction(async (tx) => {
      if (dto.weeklyBudgetCents !== undefined || dto.budgetTier !== undefined) {
        await tx.household.update({
          where: { id: household.householdId },
          data: {
            ...(dto.weeklyBudgetCents !== undefined ? { weeklyBudgetCents: dto.weeklyBudgetCents } : {}),
            ...(dto.budgetTier !== undefined ? { budgetTier: dto.budgetTier } : {}),
          },
        });
      }

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
