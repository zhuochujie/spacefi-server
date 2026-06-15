import { NestFactory } from '@nestjs/core';
import { AdminApiModule } from './admin-api.module';
import { configureHttpApp } from 'src/common/bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AdminApiModule);
  configureHttpApp(app);
  await app.listen(process.env.ADMIN_API_PORT ?? 3001);
}

void bootstrap();
