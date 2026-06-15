import { Global, Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { requiredEnv } from 'src/common/env.util';

@Global()
@Module({
  imports: [
    NestJwtModule.register({
      secret: requiredEnv('JWT_SECRET'),
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '86400s') as any,
      },
    }),
  ],
  exports: [NestJwtModule],
})
export class JwtModule {}
