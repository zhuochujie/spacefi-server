import { IsString, Matches } from 'class-validator';

export class AdminAccelerateMinerDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  amount!: string;
}
