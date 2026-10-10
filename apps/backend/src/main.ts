import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(helmet());
  // The phone app doesn't need CORS; browsers only get it for origins listed here (e.g. the web preview).
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length > 0) app.enableCors({ origin: origins });
  // Behind a load balancer, set TRUST_PROXY (e.g. 1) so rate limits see the caller's IP, not the proxy's.
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
