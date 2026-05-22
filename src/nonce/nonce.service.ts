import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class NonceService {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async generateNonce(address: string) {
    const nonce = randomUUID();
    await this.cacheManager.set(`${address}:nonce`, nonce, 60000);
    return nonce;
  }

  async getNonce(address: string) {
    const nonce = await this.cacheManager.get<string>(`${address}:nonce`);
    return nonce;
  }

  async deleteNonce(address: string) {
    await this.cacheManager.del(`${address}:nonce`);
  }
}
