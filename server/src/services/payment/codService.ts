import { IOrder } from '../../models/Order';
import { IPaymentService, PaymentHandlerResponse } from './types';

export class CODService implements IPaymentService {
    async handlePayment(
        order: IOrder
    ): Promise<PaymentHandlerResponse> {
        // COD is immediately marked as pending payment
        order.paymentStatus = 'pending';
        order.isPaid = false;
        await order.save();

        return {
            success: true,
            order,
            message: 'Order placed with Cash on Delivery.',
        };
    }
}
