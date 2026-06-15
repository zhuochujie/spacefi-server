import type Redis from 'ioredis';
import { NonceService } from './nonce.service';

describe('NonceService', () => {
  const redis = {
    set: jest.fn(),
    getdel: jest.fn(),
    quit: jest.fn(),
  } as unknown as Redis;
  let service: NonceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NonceService(redis);
  });

  it('stores a nonce in Redis with a 60 second TTL', async () => {
    await service.generateNonce('0xABC');

    expect(redis.set).toHaveBeenCalledWith(
      'auth:nonce:0xabc',
      expect.any(String),
      'PX',
      60_000,
    );
  });

  it('atomically consumes a nonce', async () => {
    (redis.getdel as jest.Mock).mockResolvedValue('nonce-value');

    await expect(service.consumeNonce('0xABC')).resolves.toBe('nonce-value');
    expect(redis.getdel).toHaveBeenCalledWith('auth:nonce:0xabc');
  });
});
