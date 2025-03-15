import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

export enum categoryType {
  vinyl = 'Vinyl',
  book = 'Book',
}

@Schema({ timestamps: true })
export class Feedbackers extends mongoose.Document {
  @Prop({})
  customerId: string;

  @Prop({})
  customerName: string;

  @Prop({})
  rating: number;

  @Prop({})
  feedbackMsg: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedbackers);

@Schema({ timestamps: true })
export class SkuDetails extends mongoose.Document {
  @Prop({})
  skuName: string;

  @Prop({})
  price: number;

  @Prop({})
  validity: number;

  @Prop({})
  lifetime: boolean;

  @Prop({})
  stripePriceId: string;

  @Prop({})
  skuCode?: string;
}

export const skuDetailsSchema = SchemaFactory.createForClass(SkuDetails);

@Schema({ timestamps: true })
export class Products {
  @Prop({ required: true })
  productName: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    default:
      'https://us.123rf.com/450wm/pavelstasevich/pavelstasevich1811/pavelstasevich181101027/112815900-no-image-available-icon-flat-vector.jpg?ver=6',
  })
  image?: string;

  @Prop({
    required: true,
    enum: [categoryType.vinyl, categoryType.book],
  })
  category: string;

  @Prop({ required: true })
  productUrl: string;

  @Prop({})
  avgRating: number;

  @Prop([{ type: FeedbackSchema }])
  feedbackDetails: Feedbackers[];

  @Prop([{ type: skuDetailsSchema }])
  skuDetails: SkuDetails[];

  @Prop({ type: Object })
  imageDetails: Record<string, any>;

  @Prop({})
  productDetails: Record<string, any>[];

  @Prop({})
  highlights: string[];

  @Prop({})
  stripeProductId: string;
}

export const ProductSchema = SchemaFactory.createForClass(Products);
