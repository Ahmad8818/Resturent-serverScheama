import { IOrder } from '../../models/Order';
import { IPaymentService, PaymentHandlerResponse } from './types';
import { uploadImage } from '../cloudinaryService';

export class BankService implements IPaymentService {
    async handlePayment(
        order: IOrder,
        payload?: { receiptBuffer?: Buffer }
    ): Promise<PaymentHandlerResponse> {

        // 1. If physical buffer is provided, upload it to Cloudinary
        if (payload?.receiptBuffer) {
            const uploadResult = await uploadImage(payload.receiptBuffer, 'bank-transfers');
            order.bankTransferProof = {
                url: uploadResult.url,
                publicId: uploadResult.public_id
            };
        }

        // 2. Bank transfer is always pending until manual verification
        order.paymentStatus = 'pending';
        order.isPaid = false;
        await order.save();

        return {
            success: true,
            order,
            message: 'Bank transfer submitted. Waiting for manual verification.',
        };
    }
}
