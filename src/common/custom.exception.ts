import { HttpException, HttpStatus } from '@nestjs/common';

// 基础自定义异常
export class CustomException extends HttpException {
  constructor(message: string, status: number = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}
