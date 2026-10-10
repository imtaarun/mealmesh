import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const BEFORE_AGE_CHECK_KEY = "beforeAgeCheck";

/** Reachable by a signed-in account that hasn't confirmed its age yet. */
export const BeforeAgeCheck = () => SetMetadata(BEFORE_AGE_CHECK_KEY, true);
