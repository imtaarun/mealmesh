import { Global, Module } from "@nestjs/common";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { ClaudeAiProvider } from "./claude-ai.provider.js";
import { FixtureAiProvider } from "./fixture-ai.provider.js";

// AI_PROVIDER=claude uses the real API; otherwise the fixture.
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
