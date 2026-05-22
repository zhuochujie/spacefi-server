import { Controller, Get, Param } from '@nestjs/common';
import { NonceService } from './nonce.service';
import { Public } from 'src/common/decorators/public.decorator';
import { AddressParamDto } from './dto/address-param.dto';

@Controller('nonce')
export class NonceController {
  constructor(private readonly nonceService: NonceService) { }

  @Public()
  @Get('/:address')
  async getNonce(@Param() params: AddressParamDto) {
    return await this.nonceService.generateNonce(params.address);
  }
}
