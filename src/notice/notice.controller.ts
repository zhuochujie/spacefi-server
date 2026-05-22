import { Controller, Get, Query } from '@nestjs/common';
import { NoticeService } from './notice.service';
import { Public } from 'src/common/decorators/public.decorator';
import { NoticeQueryDto } from './dto/notice-query.dto';

@Controller('notice')
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  @Get('latest')
  getLatestNotice() {
    return this.noticeService.getLatestNotice();
  }

  @Get()
  getNotices(@Query() query: NoticeQueryDto) {
    return this.noticeService.getNotices(query);
  }
}
