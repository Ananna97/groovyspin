import {Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, Query, UseInterceptors, UploadedFile, Put, Req} from '@nestjs/common';
import {ProductsService } from './products.service';
import {CreateProductDto } from './dto/create-product.dto';
import {Roles } from 'src/shared/middleware/role.decorators';
import {userTypes } from 'src/shared/schema/users';
import {GetProductQueryDto } from './dto/get-product-query-dto';
import {FileInterceptor } from '@nestjs/platform-express';
import * as config from 'config';
import {ProductSkuDto, ProductSkuDtoArr } from './dto/product-sku.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(201)
  @Roles(userTypes.ADMIN)
  async create(@Body() createProductDto: CreateProductDto) {
    return await this.productsService.createProduct(createProductDto);
  }

  @Get()
  findAll(@Query() query: GetProductQueryDto) {
    return this.productsService.findAllProducts(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOneProduct(id);
  }

  @Patch(':id')
  @Roles(userTypes.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: CreateProductDto,
  ) {
    return await this.productsService.updateProduct(id, updateProductDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.productsService.removeProduct(id);
  }

  @Post('/:id/image')
  @Roles(userTypes.ADMIN)
  @UseInterceptors(
    FileInterceptor('productImage', {
      dest: config.get('fileStoragePath'),
      limits: {
        fileSize: 3145728,
      },
    }),
  )
  async uploadProductImage(
    @Param('id') id: string,
    @UploadedFile() file: ParameterDecorator,
  ) {
    return await this.productsService.uploadProductImage(id, file);
  }

  @Post('/:productId/skus')
  @Roles(userTypes.ADMIN)
  async addProductSku(
    @Param('productId') productId: string,
    @Body() productSkuDto: ProductSkuDtoArr,
  ) {
    return await this.productsService.addProductSku(
      productId,
      productSkuDto,
    );
  }

  @Put('/:productId/skus/:skuId')
  @Roles(userTypes.ADMIN)
  async updateProductSkuById(
    @Param('productId') productId: string,
    @Param('skuId') skuId: string,
    @Body() productSkuDto: ProductSkuDto,
  ) {
    return await this.productsService.updateProductSkuById(
      productId,
      skuId,
      productSkuDto,
    );
  }

  @Delete('/:productId/skus/:skuId')
  @Roles(userTypes.ADMIN)
  async deleteSkuById(
    @Param('productId') productId: string,
    @Param('skuId') skuId: string,
  ) {
    return await this.productsService.deleteProductSkuById(productId, skuId);
  }

  @Post('/:productId/reviews')
  @Roles(userTypes.CUSTOMER)
  async addProductReview(
    @Param('productId') productId: string,
    @Body('rating') rating: number,
    @Body('review') review: string,
    @Req() req: any,
  ) {
    return await this.productsService.addProductReview(
      productId,
      rating,
      review,
      req.user,
    );
  }

  @Delete('/:productId/reviews/:reviewId')
  async removeProductReview(
    @Param('productId') productId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return await this.productsService.removeProductReview(productId, reviewId);
  }
}
