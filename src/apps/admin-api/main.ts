import { NestFactory } from '@nestjs/core';
import { AdminApiModule } from './admin-api.module';
import { configureHttpApp } from 'src/common/bootstrap';
import { requiredIntEnv } from 'src/common/env.util';

async function bootstrap() {
  const app = await NestFactory.create(AdminApiModule);
  configureHttpApp(app);
  await app.listen(requiredIntEnv('ADMIN_API_PORT'));
}

void bootstrap();
