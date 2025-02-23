import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import * as config from 'config';
import { AllExceptionFilter } from './httpExceptionFilter';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { StripeModule } from '@golevelup/nestjs-stripe';

@Module({
  imports: [
    MongooseModule.forRoot(config.get<string>('mongodbUrl'), {
      connectionFactory: (connection) => {
        connection.set('keepAlive', true);
        return connection;
      },
      w: 1,
    }),
    UsersModule,
    ProductsModule,
    OrdersModule,
    StripeModule.forRoot({
      apiKey: config.get<string>('stripe.secret_key'),
      apiVersion: "2025-01-27.acacia",
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'APP_FILTER',
      useClass: AllExceptionFilter,
    },
  ],
})
export class AppModule {}
