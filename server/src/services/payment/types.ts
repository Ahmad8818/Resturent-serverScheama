import { IOrder } from '../../models/Order';

export interface PaymentHandlerResponse {
    success: boolean;
    order: IOrder;
    checkoutUrl?: string; // For Stripe
    paymentIntentId?: string; // For Stripe
    message?: string;
}

export interface IPaymentService {
    handlePayment(
        order: IOrder,
        payload?: any
    ): Promise<PaymentHandlerResponse>;
}
