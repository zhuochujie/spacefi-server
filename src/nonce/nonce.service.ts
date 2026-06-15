import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { NONCE_KEY_PREFIX, NONCE_REDIS, NONCE_TTL_MS } from './nonce.constants';

@Injectable()
export class NonceService implements OnApplicationShutdown {
  constructor(
    @Inject(NONCE_REDIS)
    private readonly redis: Redis,
  ) {}

  async generateNonce(address: string) {
    const nonce = randomUUID();
    await this.redis.set(this.getNonceKey(address), nonce, 'PX', NONCE_TTL_MS);
    return nonce;
  }

  async consumeNonce(address: string) {
    return this.redis.getdel(this.getNonceKey(address));
  }

  async onApplicationShutdown() {
    await this.redis.quit();
  }

  private getNonceKey(address: string) {
    return `${NONCE_KEY_PREFIX}${address.toLowerCase()}`;
  }
}
