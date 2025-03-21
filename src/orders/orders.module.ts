import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { UserRepository } from 'src/shared/repositories/user.repository';
import { ProductRepository } from 'src/shared/repositories/product.repository';
import { OrdersRepository } from 'src/shared/repositories/order.repository';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from 'src/shared/middleware/roles.guard';
import * as config from 'config';
import { Products, ProductSchema } from 'src/shared/schema/products';
import { Orders, OrderSchema } from 'src/shared/schema/orders';
import { Users, UserSchema } from 'src/shared/schema/users';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthMiddleware } from 'src/shared/middleware/auth';
import { StripeModule } from '@golevelup/nestjs-stripe';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    UserRepository,
    ProductRepository,
    OrdersRepository,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  imports: [
    StripeModule.forRoot({
      apiKey: config.get('stripe.secret_key'),
      apiVersion: "2025-01-27.acacia",
    }),
    MongooseModule.forFeature([{ name: Products.name, schema: ProductSchema }]),
    MongooseModule.forFeature([{ name: Users.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Orders.name, schema: OrderSchema }]),
  ],
})
export class OrdersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude({
        path: '/orders/webhook',
        method: RequestMethod.POST,
      })      
      .forRoutes(OrdersController);
  }
}
