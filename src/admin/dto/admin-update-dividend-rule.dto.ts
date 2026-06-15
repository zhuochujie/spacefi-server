import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminUpdateDividendRuleItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  level!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  bp!: number;
}

export class AdminUpdateDividendRuleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdminUpdateDividendRuleItemDto)
  rules!: AdminUpdateDividendRuleItemDto[];
}
