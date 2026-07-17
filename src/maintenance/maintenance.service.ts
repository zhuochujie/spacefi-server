import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  MAINTENANCE_REDIS,
  MAINTENANCE_REDIS_KEY,
} from './maintenance.constants';

@Injectable()
export class MaintenanceService implements OnModuleDestroy {
  constructor(@Inject(MAINTENANCE_REDIS) private readonly redis: Redis) {}

  async isEnabled(): Promise<boolean> {
    try {
      const value = await this.redis.get(MAINTENANCE_REDIS_KEY);
      return value === '1';
    } catch {
      return false;
    }
  }

  async getState() {
    return {
      enabled: await this.isEnabled(),
    };
  }

  async setEnabled(enabled: boolean) {
    await this.redis.set(MAINTENANCE_REDIS_KEY, enabled ? '1' : '0');
    return { enabled };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
