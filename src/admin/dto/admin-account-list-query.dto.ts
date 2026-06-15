import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AdminAccountSortBy {
  Id = 'id',
  CreatedAt = 'createdAt',
  Balance = 'balance',
  UsdtBalance = 'usdtBalance',
  VipLevel = 'vipLevel',
  ManualVipLevel = 'manualVipLevel',
  NodeLevel = 'nodeLevel',
  TeamCount = 'teamCount',
  TeamPerformance = 'teamPerformance',
}

export enum AdminSortOrder {
  Asc = 'ASC',
  Desc = 'DESC',
}

export class AdminAccountListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  refCode?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  vipLevel?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  nodeLevel?: number;

  @IsEnum(AdminAccountSortBy)
  @IsOptional()
  sortBy = AdminAccountSortBy.CreatedAt;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(AdminSortOrder)
  @IsOptional()
  sortOrder = AdminSortOrder.Desc;
}
