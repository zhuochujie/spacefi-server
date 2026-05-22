import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [CacheModule.register()],
  exports: [CacheModule],
})
export class GlobalCacheModule {}
