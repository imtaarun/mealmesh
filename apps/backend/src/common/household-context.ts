import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

// Every request handler that touches household-owned data (pantry, meal plans,
// grocery lists, prices) must scope its Prisma queries by householdId — see
// docs/architecture.md "Cross-cutting / Auth". Pull it via @CurrentHousehold(),
// never trust a householdId in the request body/query for reads or writes.

export interface RequestHousehold {
  householdId: string;
  userId: string;
}

export const CurrentHousehold = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestHousehold => {
  const request = ctx.switchToHttp().getRequest();
  // TODO(Phase 1): populate req.household in an auth guard/middleware once session
  // auth is implemented; this decorator just reads it back out.
  return request.household;
});
