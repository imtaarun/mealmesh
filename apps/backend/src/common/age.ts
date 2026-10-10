import { BadRequestException, ForbiddenException } from "@nestjs/common";

// MealMesh is for people 16 and over (docs/open-questions.md item 29).
export const MINIMUM_AGE = 16;

/** Whole years between a YYYY-MM-DD date of birth and `today` (UTC). Null if the date isn't real. */
export function ageOn(dateOfBirth: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) return null;
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() < month - 1 || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)) age--;
  return age;
}

/** The birth year to keep, or a 400 for an impossible date / a 403 for anyone too young. */
export function checkAge(dateOfBirth: string): number {
  const age = ageOn(dateOfBirth);
  if (age === null || age < 0 || age > 120) throw new BadRequestException("That date of birth doesn't look right");
  if (age < MINIMUM_AGE) throw new ForbiddenException({ message: "Sorry — MealMesh isn't available for you yet.", code: "UNDER_AGE" });
  return Number(dateOfBirth.slice(0, 4));
}

export const ageRequired = () =>
  new BadRequestException({ message: "Add your date of birth to finish signing up.", code: "AGE_REQUIRED" });
