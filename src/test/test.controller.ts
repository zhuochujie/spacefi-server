import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { TestAddUserMinerDto } from './dto/test-add-user-miner.dto';
import { TestCreateUserDto } from './dto/test-create-user.dto';
import { TestService } from './test.service';

@Public()
@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Post('users')
  createUser(@Body() dto: TestCreateUserDto) {
    return this.testService.createUser(dto);
  }

  @Post('users/:accountId/miners')
  addUserMiner(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() dto: TestAddUserMinerDto,
  ) {
    return this.testService.addUserMiner(accountId, dto);
  }

  @Get('commission-level/miners')
  getCommissionLevelTestMiners() {
    return this.testService.getCommissionLevelTestMiners();
  }

  @Get('users/:accountId/commission-level')
  getCommissionLevel(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.testService.getCommissionLevel(accountId);
  }
}
