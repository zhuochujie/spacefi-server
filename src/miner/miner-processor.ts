import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MinerService } from "./miner.service";

@Processor('miner-queue')
export class MinerProcessor extends WorkerHost {
    private readonly logger = new Logger(MinerProcessor.name, { timestamp: true });

    constructor(
        private readonly minerService: MinerService,
    ) {
        super();
    }

    async process(job: Job<string>) {
        const nonce = job.data;
        this.logger.log(`开始处理购买矿机 nonce:${nonce}`);
        await this.minerService.processPurchaseMinerSignatureNonce(nonce);
        this.logger.log(`购买矿机 nonce 处理完成:${nonce}`);
    }
}
