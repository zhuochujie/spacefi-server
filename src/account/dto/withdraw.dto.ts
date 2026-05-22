import { Matches } from 'class-validator';

export class WithdrawDto {
  @Matches(/^[1-9]\d*$/)
  amount!: string;
}
