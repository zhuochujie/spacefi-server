import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { Config } from './entities/config.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DividendRule } from './entities/dividend-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Config, DividendRule])],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
