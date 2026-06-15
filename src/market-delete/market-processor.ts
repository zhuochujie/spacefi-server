import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MarketService } from './market.service';
import { Web3Service } from 'src/web3/web3.service';
import { MarketProcessedHash } from './entities/market-processed-hash.entity';
import { DataSource, QueryFailedError } from 'typeorm';

@Processor('market-queue')
export class MarketProcessor extends WorkerHost {
    private readonly logger = new Logger(MarketProcessor.name, { timestamp: true });

    constructor(
        private readonly web3Service: Web3Service,
        private readonly marketService: MarketService,
        private readonly dataSource: DataSource,
    ) {
        super();
    }

    async process(job: Job<string>) {
        const hash = job.data;
        this.logger.log(`开始处理市场交易 hash:${hash}`);

        const logs = await this.web3Service.getMarketEvent(hash);
        const blockNumber = logs[0].blockNumber;
        if (blockNumber === null) {
            throw new Error(`市场事件缺少区块号，hash:${hash}`);
        }

        const blockTimestamp = Number((await this.web3Service.publicClient.getBlock({ blockNumber })).timestamp);

        await this.dataSource.transaction(async (manager) => {
            const marketProcessedHashRepository = manager.getRepository(MarketProcessedHash);

            try {
                await marketProcessedHashRepository.insert({
                    hash,
                    eventCount: logs.length,
                    createdAt: Math.floor(Date.now() / 1000),
                });
            } catch (error) {
                if (this.isUniqueViolation(error)) {
                    this.logger.warn(`市场交易 hash 已处理，跳过:${hash}`);
                    return;
                }

                throw error;
            }

            for (const log of logs) {
                if (log.logIndex === null) {
                    throw new Error(`市场事件缺少日志序号，hash:${hash}`);
                }

                switch (log.eventName) {
                    case 'OrderPlaced': {
                        await this.marketService.orderPlaced(log.args, manager);
                        break;
                    }

                    case 'OrderFilled': {
                        await this.marketService.orderFilled({
                            ...log.args,
                            transactionHash: hash,
                            logIndex: Number(log.logIndex),
                            filledAt: blockTimestamp,
                        }, manager);
                        break;
                    }

                    case 'OrderCancelled': {
                        await this.marketService.orderCancelled(log.args, manager);
                        break;
                    }
                }
            }
        });

        this.logger.log(`市场交易 hash 处理完成:${hash}, 事件数量:${logs.length}`);
    }

    private isUniqueViolation(error: unknown): boolean {
        return (
            error instanceof QueryFailedError &&
            (error.driverError as { code?: string }).code === '23505'
        );
    }
}
