import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ProductRepository } from 'src/shared/repositories/product.repository';
import { Products } from 'src/shared/schema/products';
import Stripe from 'stripe';
import { CreateProductDto } from './dto/create-product.dto';
import { GetProductQueryDto } from './dto/get-product-query-dto';
import qs2m from 'qs-to-mongo';
import { v2 as cloudinary } from 'cloudinary';
import * as config from 'config';
import { unlinkSync } from 'fs';
import { ProductSkuDto, ProductSkuDtoArr } from './dto/product-sku.dto';
import { OrdersRepository } from 'src/shared/repositories/order.repository';
import { InjectStripeClient } from '@golevelup/nestjs-stripe';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(ProductRepository) private readonly productDB: ProductRepository,
    @Inject(OrdersRepository) private readonly orderDB: OrdersRepository,
    @InjectStripeClient() private readonly stripeClient: Stripe,
  ) {
    cloudinary.config({
      cloud_name: config.get('cloudinary.cloud_name'),
      api_key: config.get('cloudinary.api_key'),
      api_secret: config.get('cloudinary.api_secret'),
    });    
  }

  async createProduct(createProductDto: CreateProductDto): Promise<{
    message: string;
    result: Products;
    success: boolean;
  }> {
    try {
      if (!createProductDto.stripeProductId) {
        const createdProductInStripe = await this.stripeClient.products.create({
          name: createProductDto.productName,
          description: createProductDto.description,
        });
        createProductDto.stripeProductId = createdProductInStripe.id;
      }

      const createdProductInDB = await this.productDB.create(createProductDto);
      return {
        message: 'Product created successfully',
        result: createdProductInDB,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAllProducts(query: GetProductQueryDto) {
    try {
      let callForHomePage = false;
      if (query.homepage) {
        callForHomePage = true;
      }
      const qs2m = require('qs-to-mongo');

      const { criteria, options, links } = qs2m(query);

      if (callForHomePage) {
        const products = await this.productDB.findProductWithGroupBy();
        return {
          message:
            products.length > 0
              ? 'Products fetched successfully'
              : 'No products found',
          result: products,
          success: true,
        };
      }
      const { totalProductCount, products } = await this.productDB.find(
        criteria,
        options,
      );
      return {
        message:
          products.length > 0
            ? 'Products fetched successfully'
            : 'No products found',
        result: {
          metadata: {
            skip: options.skip || 0,
            limit: options.limit || 10,
            total: totalProductCount,
            pages: options.limit
              ? Math.ceil(totalProductCount / options.limit)
              : 1,
            links: links('/', totalProductCount),
          },
          products,
        },
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async findOneProduct(id: string): Promise<{
    message: string;
    result: { product: Products; relatedProducts: Products[] };
    success: boolean;
  }> {
    try {
      const product = await this.productDB.findOne({ _id: id }) as Products | null;
      if (!product) {
        throw new Error('Product does not exist');
      }
  
      const relatedProducts: Products[] =
        await this.productDB.findRelatedProducts({
          category: product.category,
          _id: { $ne: id },
        });
  
      return {
        message: 'Product fetched successfully',
        result: { product, relatedProducts },
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }
  
  async updateProduct(
    id: string,
    updateProductDto: CreateProductDto,
  ): Promise<{
    message: string;
    result: Products | null;
    success: boolean;
  }> {
    try {
      const productExist = await this.productDB.findOne({ _id: id }) as Products | null;
      if (!productExist) {
        throw new Error('Product does not exist');
      }
  
      const updatedProduct = await this.productDB.findOneAndUpdate(
        { _id: id },
        updateProductDto,
      ) as Products | null;
  
      if (!updateProductDto.stripeProductId)
        await this.stripeClient.products.update(productExist.stripeProductId, {
          name: updateProductDto.productName,
          description: updateProductDto.description,
        });
  
      if (!updatedProduct) {
        throw new Error('Failed to update product');
      }
  
      return {
        message: 'Product updated successfully',
        result: updatedProduct,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }  

  async removeProduct(id: string): Promise<{
    message: string;
    success: boolean;
    result: null;
  }> {
    try {
      const productExist = await this.productDB.findOne({ _id: id });
      if (!productExist) {
        throw new Error('Product does not exist');
      }
      await this.productDB.findOneAndDelete({ _id: id });
      await this.stripeClient.products.del(productExist.stripeProductId);
      return {
        message: 'Product deleted successfully',
        success: true,
        result: null,
      };
    } catch (error) {
      throw error;
    }
  }

  async uploadProductImage(
    id: string,
    file: any,
  ): Promise<{
    message: string;
    success: boolean;
    result: string;
  }> {
    try {
      const product = await this.productDB.findOne({ _id: id });
      if (!product) {
        throw new Error('Product does not exist');
      }
      if (product.imageDetails?.public_id) {
        await cloudinary.uploader.destroy(product.imageDetails.public_id, {
          invalidate: true,
        });
      }
  
      const bigSize = config.get<string>('cloudinary.bigSize');
      const [width, height] = bigSize.split('X');
  
      const resOfCloudinary = await cloudinary.uploader.upload(file.path, {
        folder: config.get('cloudinary.folderPath'),
        public_id: `${config.get('cloudinary.publicId_prefix')}${Date.now()}`,
        transformation: [
          {
            width: width,
            height: height,
            crop: 'fill',
          },
          { quality: 'auto' },
        ],
      });
      unlinkSync(file.path);
      await this.productDB.findOneAndUpdate(
        { _id: id },
        {
          imageDetails: resOfCloudinary,
          image: resOfCloudinary.secure_url,
        },
      );
  
      await this.stripeClient.products.update(product.stripeProductId, {
        images: [resOfCloudinary.secure_url],
      });
  
      return {
        message: 'Image uploaded successfully',
        success: true,
        result: resOfCloudinary.secure_url,
      };
    } catch (error) {
      throw error;
    }
  }  

  async addProductSku(productId: string, data: ProductSkuDtoArr) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }
  
      const skuCode = Math.random().toString(36).substring(2, 5) + Date.now();
      for (let i = 0; i < data.skuDetails.length; i++) {
        if (!data.skuDetails[i].stripePriceId) {
          const stripPriceDetails = await this.stripeClient.prices.create({
            unit_amount: data.skuDetails[i].price * 100,
            currency: 'inr',
            product: product.stripeProductId,
            metadata: {
              skuCode: skuCode ?? null,
              lifetime: data.skuDetails[i].lifetime + '',
              productId: productId,
              price: data.skuDetails[i].price,
              productName: product.productName ?? '',
              productImage: product.image ?? null,
            },
          });
          data.skuDetails[i].stripePriceId = stripPriceDetails.id;
        }
        data.skuDetails[i].skuCode = skuCode ?? null;
      }
  
      await this.productDB.findOneAndUpdate(
        { _id: productId },
        { $push: { skuDetails: data.skuDetails } },
      );
  
      return {
        message: 'Product sku added successfully',
        success: true,
        result: null,
      };
    } catch (error) {
      throw error;
    }
  }
  
  async updateProductSkuById(
    productId: string,
    skuId: string,
    data: ProductSkuDto,
  ) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }
  
      const sku = product.skuDetails.find((sku) => sku._id == skuId);
      if (!sku) {
        throw new Error('Sku does not exist');
      }
  
      if (data.price !== sku.price) {
        const priceDetails = await this.stripeClient.prices.create({
          unit_amount: data.price * 100,
          currency: 'inr',
          product: product.stripeProductId,
          metadata: {
            skuCode: sku.skuCode ?? null,
            lifetime: data.lifetime + '',
            productId: productId,
            price: data.price,
            productName: product.productName ?? '',
            productImage: product.image ?? null,
          },
        });
  
        data.stripePriceId = priceDetails.id;
      }
  
      const dataForUpdate: Record<string, any> = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          dataForUpdate[`skuDetails.$.${key}`] = data[key];
        }
      }
  
      const result = await this.productDB.findOneAndUpdate(
        { _id: productId, 'skuDetails._id': skuId },
        { $set: dataForUpdate },
      );
  
      return {
        message: 'Product sku updated successfully',
        success: true,
        result,
      };
    } catch (error) {
      throw error;
    }
  }
  
  async deleteProductSkuById(id: string, skuId: string) {
    try {
      const productDetails = await this.productDB.findOne({ _id: id }) as (Products & { _id: string }) | null;
      if (!productDetails) {
        throw new Error('Product does not exist');
      }
  
      const skuDetails = productDetails.skuDetails.find(
        (sku) => String(sku._id) === String(skuId),
      );
  
      if (!skuDetails) {
        throw new Error('Sku does not exist');
      }
  
      await this.stripeClient.prices.update(skuDetails.stripePriceId, {
        active: false,
      });

  
      return {
        message: 'Product SKU details deleted successfully',
        success: true,
        result: {
          id,
          skuId,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async addProductReview(
    productId: string,
    rating: number,
    review: string,
    user: Record<string, any>,
  ) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }

      if (
        product.feedbackDetails.find(
          (value: { customerId: string }) =>
            value.customerId === user._id.toString(),
        )
      ) {
        throw new BadRequestException(
          'You have already gave the review for this product',
        );
      }

      const order = await this.orderDB.findOne({
        userId: user._id,
        'orderedItems.productId': productId,
      });

      if (!order) {
        throw new BadRequestException('You have not purchased this product');
      }

      const ratings: any[] = [];
      product.feedbackDetails.forEach((comment: { rating: any }) =>
        ratings.push(comment.rating),
      );

      let avgRating = String(rating);
      if (ratings.length > 0) {
        avgRating = (ratings.reduce((a, b) => a + b) / ratings.length).toFixed(
          2,
        );
      }

      const reviewDetails = {
        rating: rating,
        feedbackMsg: review,
        customerId: user._id,
        customerName: user.name,
      };

      const result = await this.productDB.findOneAndUpdate(
        { _id: productId },
        { $set: { avgRating }, $push: { feedbackDetails: reviewDetails } },
      );

      return {
        message: 'Product review added successfully',
        success: true,
        result,
      };
    } catch (error) {
      throw error;
    }
  }

  async removeProductReview(productId: string, reviewId: string) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }

      const review = product.feedbackDetails.find(
        (review) => review._id == reviewId,
      );
      if (!review) {
        throw new Error('Review does not exist');
      }

      const ratings: any[] = [];
      product.feedbackDetails.forEach((comment) => {
        if ((comment._id as string).toString() !== reviewId) {
          ratings.push(comment.rating);
        }
      });      

      let avgRating = '0';
      if (ratings.length > 0) {
        avgRating = (ratings.reduce((a, b) => a + b) / ratings.length).toFixed(
          2,
        );
      }

      const result = await this.productDB.findOneAndUpdate(
        { _id: productId },
        { $set: { avgRating }, $pull: { feedbackDetails: { _id: reviewId } } },
      );

      return {
        message: 'Product review removed successfully',
        success: true,
        result,
      };
    } catch (error) {
      throw error;
    }
  }
}