import { Transform, Type } from 'class-transformer';
import {
  IsEthereumAddress,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TestCreateUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEthereumAddress()
  address!: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]+$/)
  recommenderRefCode?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]+$/)
  @MaxLength(32)
  refCode?: string;

  @IsNumberString({ no_symbols: true })
  @IsOptional()
  balance?: string;

  @IsNumberString({ no_symbols: true })
  @IsOptional()
  usdtBalance?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  @IsOptional()
  nodeLevel?: number;
}
