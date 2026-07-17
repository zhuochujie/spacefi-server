import { IsBoolean } from 'class-validator';

export class UpdateMaintenanceDto {
  @IsBoolean()
  enabled!: boolean;
}
