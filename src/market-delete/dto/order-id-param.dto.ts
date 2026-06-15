import { Matches } from 'class-validator';

export class OrderIdParamDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  id!: string;
}
