import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HouseholdsModule } from "./modules/households/households.module.js";
import { MeModule } from "./modules/me/me.module.js";
import { MealPlansModule } from "./modules/meal-plans/meal-plans.module.js";
import { RecipesModule } from "./modules/recipes/recipes.module.js";
import { PantryModule } from "./modules/pantry/pantry.module.js";
import { GroceryListModule } from "./modules/grocery-list/grocery-list.module.js";
import { AiProviderModule } from "./providers/ai/ai-provider.module.js";
import { GroceryProviderModule } from "./providers/grocery/grocery-provider.module.js";
import { PrismaModule } from "./common/prisma.module.js";
import { AuthGuard } from "./common/auth.guard.js";
import { DEFAULT_LIMIT } from "./common/rate-limits.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([DEFAULT_LIMIT]),
    PrismaModule,
    AiProviderModule,
    GroceryProviderModule,
    AuthModule,
    HouseholdsModule,
    MeModule,
    MealPlansModule,
    RecipesModule,
    PantryModule,
    GroceryListModule,
  ],
  // Rate limit first, so floods are turned away before any database work.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
