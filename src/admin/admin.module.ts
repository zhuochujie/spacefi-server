import { Module } from '@nestjs/common';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [MaintenanceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
