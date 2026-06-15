import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class TestAddUserMinerDto {
  @IsString()
  minerId!: string;

  @IsNumberString({ no_symbols: true })
  @IsOptional()
  expectedReward?: string;
}
