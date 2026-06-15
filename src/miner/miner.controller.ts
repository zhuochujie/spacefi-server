import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MinerService } from './miner.service';
import {
  CurrentAccount,
  type JwtAccount,
} from 'src/common/decorators/current-account.decorator';
import { PurchaseMinerDto } from './dto/purchase-miner.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { SubmitNonceDto } from './dto/submit-nonce.dto';
import { NonceParamDto } from './dto/nonce-param.dto';
import { SubmitFreeMinerHashDto } from './dto/submit-free-miner-hash.dto';

@Controller('miner')
export class MinerController {
  constructor(private readonly minerService: MinerService) {}

  @Get()
  async getMiners(@CurrentAccount() account: JwtAccount) {
    return this.minerService.getMiners(account.sub);
  }

  @Get('my')
  async getMyMiners(@CurrentAccount() account: JwtAccount) {
    return this.minerService.getMyMiners(account.sub);
  }

  @Get('initial-cycle')
  getInitialCycle() {
    return this.minerService.getInitialCycle();
  }

  @Public()
  @Get('space-usdt-price')
  getSpaceUsdtPrice() {
    return this.minerService.getSpaceUsdtPrice();
  }

  @Public()
  @Get('reward-start-at')
  getMinerRewardStartAt() {
    return this.minerService.getMinerRewardStartAt();
  }

  @Public()
  @Post('nonce')
  submitNonce(@Body() submitNonceDto: SubmitNonceDto) {
    return this.minerService.submitNonce(submitNonceDto.nonce);
  }

  @Get('nonce/:nonce')
  getNonceStatus(@Param() params: NonceParamDto) {
    return this.minerService.getPurchaseMinerNonceStatus(params.nonce);
  }

  @Post('purchase')
  async purchaseMiner(
    @CurrentAccount() account: JwtAccount,
    @Body() purchaseMinerDto: PurchaseMinerDto,
  ) {
    return this.minerService.generatePurchaseMinerSignature(
      account.sub,
      purchaseMinerDto.minerId,
      purchaseMinerDto.method,
    );
  }

  @Post('free/hash')
  submitFreeMinerHash(
    @CurrentAccount() account: JwtAccount,
    @Body() submitFreeMinerHashDto: SubmitFreeMinerHashDto,
  ) {
    return this.minerService.submitFreeMinerHash(
      account.sub,
      account.address,
      submitFreeMinerHashDto.hash,
    );
  }

  @Get('free/my')
  getMyFreeMiner(@CurrentAccount() account: JwtAccount) {
    return this.minerService.getMyFreeMiner(account.sub);
  }

  @Post('free/claim-reward')
  claimFreeMinerReward(@CurrentAccount() account: JwtAccount) {
    return this.minerService.claimFreeMinerReward(account.sub);
  }

  @Get('free/hash/:hash')
  getFreeMinerHashStatus(@Param() params: SubmitFreeMinerHashDto) {
    return this.minerService.getFreeMinerHashStatus(params.hash);
  }
}
