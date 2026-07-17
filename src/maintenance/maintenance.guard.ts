import {
  CanActivate,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  async canActivate() {
    if (await this.maintenanceService.isEnabled()) {
      throw new ConflictException('SYSTEM_MAINTENANCE');
    }

    return true;
  }
}
