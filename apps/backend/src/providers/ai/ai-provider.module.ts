import { Global, Module } from "@nestjs/common";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { ClaudeAiProvider } from "./claude-ai.provider.js";
import { FixtureAiProvider } from "./fixture-ai.provider.js";

// Provider choice comes from env (docs/architecture.md). Default to the fixture so
// local dev and tests never hit the network unless AI_PROVIDER=claude is set.
// Global so every feature module can inject AI_PROVIDER without importing this module
// individually — same pattern as PrismaModule.
@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useClass: process.env.AI_PROVIDER === "claude" ? ClaudeAiProvider : FixtureAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}
