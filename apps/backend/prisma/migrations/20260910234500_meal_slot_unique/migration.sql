-- Hand-written: prisma migrate dev requires a TTY that isn't available in this
-- environment; the SQL is exactly what `prisma migrate dev` would have generated for
-- adding `@@unique([mealPlanId, date, slot])` to Meal.
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_mealPlanId_date_slot_key" UNIQUE ("mealPlanId", "date", "slot");
