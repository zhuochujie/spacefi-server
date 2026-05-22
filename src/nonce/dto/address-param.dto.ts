import { Transform } from 'class-transformer';
import { IsEthereumAddress, Matches } from 'class-validator';

export class AddressParamDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.toLowerCase().trim() : value,
    )
    @IsEthereumAddress()
    address!: string;
}