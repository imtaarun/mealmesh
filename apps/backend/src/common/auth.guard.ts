import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "./prisma.service.js";
import { hashSessionToken } from "./session.js";
import { BEFORE_AGE_CHECK_KEY, IS_PUBLIC_KEY } from "./public.decorator.js";

/** Sets req.household from the bearer session token; @Public() routes skip it. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    if (!token) throw new UnauthorizedException("Missing session token");

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired or invalid");
    }

    // Accounts from before the age check answer it before anything else.
    const beforeAgeCheck = this.reflector.getAllAndOverride<boolean>(BEFORE_AGE_CHECK_KEY, [context.getHandler(), context.getClass()]);
    if (!session.user.ageConfirmedAt && !beforeAgeCheck) {
      throw new ForbiddenException({ message: "Confirm your date of birth to keep using MealMesh.", code: "AGE_REQUIRED" });
    }

    request.household = { householdId: session.user.householdId, userId: session.userId, sessionId: session.id };
    return true;
  }
}
