import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AccountService } from 'src/account/account.service';
import { ConfigService } from 'src/config/config.service';
import { MinerService } from 'src/miner/miner.service';
import { BuybackService } from 'src/buyback/buyback.service';

@Injectable()
export class UserDataInitializerService implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    private readonly accountService: AccountService,
    private readonly minerService: MinerService,
    private readonly buybackService: BuybackService,
  ) {}

  async onApplicationBootstrap() {
    await this.configService.initializeDefaults();
    await this.accountService.initializeDefaults();
    await this.minerService.initializeDefaults();
    await this.buybackService.initializeDefaults();
  }
}
