import { NestFactory } from '@nestjs/core';
import { configureHttpApp } from 'src/common/bootstrap';
import { UserApiModule } from './user-api.module';

async function bootstrap() {
  const app = await NestFactory.create(UserApiModule);
  configureHttpApp(app);
  await app.listen(process.env.USER_API_PORT ?? process.env.PORT ?? 3000);
}

void bootstrap();
