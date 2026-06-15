import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { TestController } from './test.controller';
import { TestService } from './test.service';

@Module({
  imports: [ConfigModule],
  controllers: [TestController],
  providers: [TestService],
})
export class TestModule {}
