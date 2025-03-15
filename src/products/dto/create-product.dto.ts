import {IsArray, IsEnum, IsNotEmpty, IsOptional, IsString} from 'class-validator';
import {categoryType, SkuDetails} from 'src/shared/schema/products';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  image?: string;

  @IsOptional()
  imageDetails?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  @IsEnum(categoryType)
  category: string;

  @IsString()
  @IsNotEmpty()
  productUrl: string;

  @IsArray()
  @IsNotEmpty()
  productDetails: Record<string, any>[];

  @IsArray()
  @IsNotEmpty()
  highlights: string[];

  @IsOptional()
  @IsArray()
  skuDetails: SkuDetails[];

  @IsOptional()
  stripeProductId?: string;
}
