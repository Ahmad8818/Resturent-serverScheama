import { IOrder } from '../../models/Order';
import { IPaymentService, PaymentHandlerResponse } from './types';
import { CODService } from './codService';
import { StripeService } from './stripeService';
import { BankService } from './bankService';
import AppError from '../../utils/AppError';

export class PaymentStrategy {
    private static handlers: Record<string, IPaymentService> = {
        'COD': new CODService(),
        'STRIPE': new StripeService(),
        'BANK': new BankService()
    };

    static async processPayment(
        order: IOrder,
        payload?: any
    ): Promise<PaymentHandlerResponse> {
        const handler = this.handlers[order.paymentMethod];

        if (!handler) {
            throw new AppError(`Unsupported payment method: ${order.paymentMethod}`, 400);
        }

        return handler.handlePayment(order, payload);
    }
}
