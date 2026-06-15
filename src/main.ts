import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttpApp } from './common/bootstrap';
import { requiredIntEnv } from './common/env.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app);
  await app.listen(requiredIntEnv('PORT'));
}
void bootstrap();
