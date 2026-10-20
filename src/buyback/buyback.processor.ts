import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BuybackService } from './buyback.service';

@Processor('buyback-queue')
export class BuybackProcessor extends WorkerHost {
  constructor(private readonly service: BuybackService) {
    super();
  }

  process(job: Job<{ accountId: number; nonce: string }>) {
    return this.service.processNonce(job.data.accountId, job.data.nonce);
  }
}
