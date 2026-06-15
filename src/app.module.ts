import { Module } from '@nestjs/common';
import { UserApiModule } from './apps/user-api/user-api.module';

@Module({
  imports: [UserApiModule],
})
export class AppModule {}
