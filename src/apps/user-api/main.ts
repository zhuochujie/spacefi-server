import { NestFactory } from '@nestjs/core';
import { configureHttpApp } from 'src/common/bootstrap';
import { requiredIntEnv } from 'src/common/env.util';
import { UserApiModule } from './user-api.module';

async function bootstrap() {
  const app = await NestFactory.create(UserApiModule);
  configureHttpApp(app);
  await app.listen(requiredIntEnv('USER_API_PORT'));
}

void bootstrap();
