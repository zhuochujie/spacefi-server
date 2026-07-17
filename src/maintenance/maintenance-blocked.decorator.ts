import { UseGuards } from '@nestjs/common';
import { MaintenanceGuard } from './maintenance.guard';

export const MaintenanceBlocked = () => UseGuards(MaintenanceGuard);
