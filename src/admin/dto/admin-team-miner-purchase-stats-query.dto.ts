import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class AdminTeamMinerPurchaseStatsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  from!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  to!: number;
}
