import { IsBoolean } from 'class-validator';

export class AdminUpdateMarketMakerWhitelistDto {
  @IsBoolean()
  enabled!: boolean;
}
