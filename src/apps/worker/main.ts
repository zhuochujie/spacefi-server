import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker-app.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerAppModule);
}

void bootstrap();
