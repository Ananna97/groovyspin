import {ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested} from 'class-validator';
export class checkoutDto {
  @IsString()
  @IsNotEmpty()
  skuPriceId: string;

  @IsString()
  @IsNotEmpty()
  skuId: string;
}

export class checkoutDtoArr {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  checkoutDetails: checkoutDto[];
}
