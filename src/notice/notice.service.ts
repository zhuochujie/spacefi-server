import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoticeQueryDto } from './dto/notice-query.dto';
import { Notice } from './entities/Notice.entity';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
  ) {}

  async getLatestNotice() {
    return await this.noticeRepository.findOne({
      where: {},
      order: {
        createTime: 'DESC',
        id: 'DESC',
      },
    });
  }

  async getNotices(query: NoticeQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;

    const [list, total] = await this.noticeRepository.findAndCount({
      order: {
        createTime: 'DESC',
        id: 'DESC',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      total,
      page,
      pageSize,
    };
  }
}
