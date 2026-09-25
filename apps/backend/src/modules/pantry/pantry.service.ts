import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { RequestHousehold } from "../../common/household-context.js";

/** Pantry CRUD + "Use It First" — docs/product-spec.md "Pantry". */
@Injectable()
export class PantryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(_household: RequestHousehold): Promise<never> {
    throw new Error("PantryService.list: not yet implemented — Phase 6");
  }

  async addItem(_household: RequestHousehold, _input: unknown): Promise<never> {
    throw new Error("PantryService.addItem: not yet implemented — Phase 6");
  }

  async updateItem(_household: RequestHousehold, _id: string, _patch: unknown): Promise<never> {
    throw new Error("PantryService.updateItem: not yet implemented — Phase 6");
  }
}
