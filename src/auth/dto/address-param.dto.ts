import { Transform } from 'class-transformer';
import { IsEthereumAddress } from 'class-validator';

export class AddressParamDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEthereumAddress()
  address!: string;
}
