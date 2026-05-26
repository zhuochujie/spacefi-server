import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class AdminUpdateDividendRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  bp!: number;
}
