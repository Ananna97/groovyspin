import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { OrdersRepository } from 'src/shared/repositories/order.repository';
import { ProductRepository } from 'src/shared/repositories/product.repository';
import { UserRepository } from 'src/shared/repositories/user.repository';
import Stripe from 'stripe';
import { checkoutDtoArr } from './dto/checkout.dto';
import * as config from 'config';
import { userTypes } from 'src/shared/schema/users';
import { orderStatus, paymentStatus } from 'src/shared/schema/orders';
import { sendEmail } from 'src/shared/utility/mail-handler';
import { InjectStripeClient } from '@golevelup/nestjs-stripe';

@Injectable()
export class OrdersService {
  constructor(
    @InjectStripeClient() private readonly stripeClient: Stripe,
    @Inject(OrdersRepository) private readonly orderDB: OrdersRepository,
    @Inject(ProductRepository) private readonly productDB: ProductRepository,
    @Inject(UserRepository) private readonly userDB: UserRepository,
  ) {}

  async create(createOrderDto: Record<string, any>) {
    try {
      const orderExists = await this.orderDB.findOne({
        checkoutSessionId: createOrderDto.checkoutSessionId,
      });
      if (orderExists) return orderExists;
      const result = await this.orderDB.create(createOrderDto);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async findAll(status: string, user: Record<string, any>) {
    try {
      const userDetails = await this.userDB.findOne({
        _id: user._id.toString(),
      });

      if (!userDetails) {
        throw new BadRequestException('User not found');
      }

      const query = {} as Record<string, any>;

      if (userDetails.type === userTypes.CUSTOMER) {
        query.userId = user._id.toString();
      }

      if (status) {
        query.status = status;
      }

      const orders = await this.orderDB.find(query);
      return {
        success: true,
        result: orders,
        message: 'Orders fetched successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const result = await this.orderDB.findOne({ _id: id });
      return {
        success: true,
        result,
        message: 'Order fetched successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async checkout(body: checkoutDtoArr, user: Record<string, any>) {
    try {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      const cartItems = body.checkoutDetails;
      
      for (const item of cartItems) {
        lineItems.push({
          price: item.skuPriceId,
          quantity: item.quantity,
          adjustable_quantity: {
            enabled: true,
            maximum: 5,
            minimum: 1,
          },
        });
      }

      if (lineItems.length === 0) {
        throw new BadRequestException(
          'No products available for checkout',
        );
      }

      const session = await this.stripeClient.checkout.sessions.create({
        line_items: lineItems,
        metadata: {
          userId: user._id.toString(),
        },
        mode: 'payment',
        billing_address_collection: 'required',
        phone_number_collection: {
          enabled: true,
        },
        customer_email: user.email,
        success_url: config.get('stripe.successUrl'),
        cancel_url: config.get('stripe.cancelUrl'),
      });

      return {
        message: 'Payment checkout session successfully created',
        success: true,
        result: session.url,
      };
    } catch (error) {
      throw error;
    }
  }

  async webhook(rawBody: Buffer, sig: string) {
    try {
      let event;
      try {
        event = this.stripeClient.webhooks.constructEvent(
          rawBody,
          sig,
          config.get('stripe.webhookSecret'),
        );
      } catch (err) {
        throw new BadRequestException('Webhook Error:', err.message);
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderData = await this.createOrderObject(session);
        const order = await this.create(orderData);
        if (session.payment_status === paymentStatus.paid) {
          await this.fullfillOrder(session.id, {
            orderStatus: orderStatus.completed,
            isOrderDelivered: true,
            ...orderData,
          });
          this.sendOrderEmail(
            orderData.customerEmail,
            orderData.orderId,
            `${config.get('emailService.emailTemplates.orderSuccess')}${order._id}`,
          );
        }
      } else {
        console.log('Unhandled event type', event.type);
      }
    } catch (error) {
      throw error;
    }
  }

  async fullfillOrder(
    checkoutSessionId: string,
    updateOrderDto: Record<string, any>,
  ) {
    try {
      return await this.orderDB.findOneAndUpdate(
        { checkoutSessionId },
        updateOrderDto,
        { new: true },
      );
    } catch (error) {
      throw error;
    }
  }

  async sendOrderEmail(email: string, orderId: string, orderLink: string) {
    await sendEmail(
      email,
      config.get('emailService.emailTemplates.orderSuccess'),
      'Order Success!',
      {
        orderId,
        orderLink,
      },
    );
  }

  async createOrderObject(session: Stripe.Checkout.Session) {
    try {
      const lineItems = await this.stripeClient.checkout.sessions.listLineItems(
        session.id,
      );

      const orderData = {
        orderId: Math.floor(new Date().valueOf() * Math.random()) + '',
        userId: session.metadata?.userId
          ? session.metadata.userId.toString()
          : '',
        customerAddress: session.customer_details?.address ?? {},
        customerEmail: session.customer_email ?? '',
        customerPhoneNumber: session.customer_details?.phone ?? '',
        paymentInfo: {
          paymentMethod: session.payment_method_types?.[0] ?? 'unknown',
          paymentIntentId: session.payment_intent ?? '',
          paymentDate: new Date(),
          paymentAmount: (session.amount_total ?? 0) / 100,
          paymentStatus: session.payment_status ?? 'unpaid',
        },
        orderDate: new Date(),
        checkoutSessionId: session.id ?? '',
        orderedItems: lineItems.data.map((item) => {
          if (!item.price || !item.price.metadata) {
            throw new BadRequestException(
              `Invalid price data for item: ${item.description}`,
            );
          }
          return {
            ...item.price.metadata,
            quantity: item.quantity?.toString() ?? '0',
          };
        }),
      };
      return orderData;
    } catch (error) {
      throw error;
    }
  }
}
