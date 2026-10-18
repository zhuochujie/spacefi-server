import { IsString, Matches, MaxLength } from 'class-validator';

export class AdminUpdateMarketVolumeAdjustmentDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^-?\d+$/)
  amount!: string;
}
