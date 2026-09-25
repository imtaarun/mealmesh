import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import { AI_PROVIDER, type AIProvider } from "../../providers/ai/ai-provider.interface.js";

export interface RecipeListFilters {
  cuisine?: string | undefined;
  dietTag?: string | undefined;
  maxPrepMinutes?: number | undefined;
  query?: string | undefined;
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
  ) {}

  /** Build My Week's browse view — the local library only (docs/product-spec.md
   * "Build My Week"). AI-generated recipes never appear here regardless of tier. */
  async list(filters: RecipeListFilters) {
    return this.prisma.recipe.findMany({
      where: {
        source: "seed",
        ...(filters.cuisine ? { cuisines: { has: filters.cuisine } } : {}),
        ...(filters.dietTag ? { dietTags: { has: filters.dietTag } } : {}),
        ...(filters.maxPrepMinutes !== undefined ? { prepMinutes: { lte: filters.maxPrepMinutes } } : {}),
        ...(filters.query ? { title: { contains: filters.query, mode: "insensitive" } } : {}),
      },
      orderBy: { title: "asc" },
    });
  }

  async getById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) throw new NotFoundException(`Recipe "${id}" not found`);
    return recipe;
  }

  async generate(_input: unknown): Promise<never> {
    throw new Error("RecipesService.generate: not yet implemented — Phase 5, Pro only");
  }
}
