import { IsEnum, IsString } from "class-validator";
import { PurchaseMethod } from "../enums/purchase-method.enum";

export class PurchaseMinerDto {
    @IsString()
    minerId!: string;

    @IsEnum(PurchaseMethod)
    method!: PurchaseMethod;
}
