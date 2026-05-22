import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentAccount = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().account;
  },
);

export interface JwtAccount {
  sub: number;
  address: string;
}