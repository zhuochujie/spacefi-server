import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';

export class SubmitNonceDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsUUID()
  nonce!: string;
}
