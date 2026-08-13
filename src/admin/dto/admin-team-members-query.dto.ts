import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AdminPageQueryDto } from './admin-page-query.dto';

export class AdminTeamMembersQueryDto extends AdminPageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  level?: number;

  @IsString()
  @IsOptional()
  address?: string;
}
