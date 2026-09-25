import { Module } from "@nestjs/common";
import { PantryController } from "./pantry.controller.js";
import { PantryService } from "./pantry.service.js";

@Module({
  controllers: [PantryController],
  providers: [PantryService],
})
export class PantryModule {}
