import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MinerService } from './miner.service';
import { CurrentAccount, type JwtAccount } from 'src/common/decorators/current-account.decorator';
import { PurchaseMinerDto } from './dto/purchase-miner.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { SubmitNonceDto } from './dto/submit-nonce.dto';
import { NonceParamDto } from './dto/nonce-param.dto';

@Controller('miner')
export class MinerController {
  constructor(private readonly minerService: MinerService) {}

  @Get()
  async getMiners() {
    return this.minerService.getMiners();
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
  @Post('nonce')
  submitNonce(
    @Body() submitNonceDto: SubmitNonceDto,
  ) {
    return this.minerService.submitNonce(submitNonceDto.nonce);
  }

  @Get('nonce/:nonce')
  getNonceStatus(@Param() params: NonceParamDto) {
    return this.minerService.getPurchaseMinerNonceStatus(params.nonce);
  }

  @Post('purchase')
  async purchaseMiner(@CurrentAccount() account: JwtAccount, @Body() purchaseMinerDto: PurchaseMinerDto) {
    return this.minerService.generatePurchaseMinerSignature(account.sub, purchaseMinerDto.minerId, purchaseMinerDto.method);
  }
  
}
