import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

// Scope every query by this householdId; never trust one from the request.

export interface RequestHousehold {
  householdId: string;
  userId: string;
  sessionId: string;
}

export const CurrentHousehold = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestHousehold => {
  const request = ctx.switchToHttp().getRequest();
  return request.household;
});
