import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FreeMinerHashJobData, MinerService } from './miner.service';

@Processor('miner-queue')
export class MinerProcessor extends WorkerHost {
  private readonly logger = new Logger(MinerProcessor.name, {
    timestamp: true,
  });

  constructor(private readonly minerService: MinerService) {
    super();
  }

  async process(job: Job<string | FreeMinerHashJobData>) {
    if (job.name === 'mining-nonce') {
      const nonce = job.data as string;
      this.logger.log(`开始处理购买矿机 nonce:${nonce}`);
      await this.minerService.processPurchaseMinerSignatureNonce(nonce);
      this.logger.log(`购买矿机 nonce 处理完成:${nonce}`);
    } else if (job.name === 'free-miner-hash') {
      const data = job.data as FreeMinerHashJobData;
      this.logger.log(`开始处理免费矿机 hash:${data.hash}`);
      await this.minerService.processFreeMinerHash(data);
      this.logger.log(`免费矿机 hash 处理完成:${data.hash}`);
    }
  }
}
