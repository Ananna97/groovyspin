import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { Products } from '../schema/products';
import { ParsedOptions } from 'qs-to-mongo/dist/query/options-to-mongo';

@Injectable()
export class ProductRepository {
  constructor(
    @InjectModel(Products.name) private readonly productModel: Model<Products>,
  ) {}

  async create(product: CreateProductDto) {
    const createdProduct = await this.productModel.create(product);
    return createdProduct;
  }

  async findOne(query: any) {
    const product = await this.productModel.findOne(query);
    return product;
  }

  async findOneAndUpdate(query: any, update: any) {
    const product = await this.productModel.findOneAndUpdate(query, update, {
      new: true,
    });
    return product;
  }

  async findOneAndDelete(query: any) {
    const product = await this.productModel.findOneAndDelete(query);
    return product;
  }

  async findProductWithGroupBy() {
    const products = await this.productModel.aggregate([
      {
        $facet: {
          latestProducts: [{ $sort: { createdAt: -1 } }, { $limit: 4 }],
          topRatedProducts: [{ $sort: { avgRating: -1 } }, { $limit: 8 }],
        },
      },
    ]);
    return products;
  }

  async find(query: Record<string, any>, options: ParsedOptions) {
    options.sort = options.sort || { _id: 1 };
    options.limit = options.limit || 12;
    options.skip = options.skip || 0;

    if (query.search) {
      query.productName = new RegExp(query.search, 'i');
      delete query.search;
    }

    const products = await this.productModel.aggregate([
      {
        $match: query,
      },
      {
        $sort: options.sort,
      },
      { $skip: options.skip },
      { $limit: options.limit },
    ]);

    const totalProductCount = await this.productModel.countDocuments(query);
    return { totalProductCount, products };
  }

  async findRelatedProducts(query: Record<string, any>) {
    const products = await this.productModel.aggregate([
      {
        $match: query,
      },
      {
        $sample: { size: 4 },
      },
    ]);
    return products;
  }
}
