import { Module } from '@nestjs/common';
import { NonceService } from './nonce.service';
import { NonceController } from './nonce.controller';

@Module({
  controllers: [NonceController],
  providers: [NonceService],
  exports: [NonceService],
})
export class NonceModule {}
