import stripe from '../../config/stripe';
import { IOrder } from '../../models/Order';
import { IPaymentService, PaymentHandlerResponse } from './types';

export class StripeService implements IPaymentService {
    /**
     * Creates a Stripe Checkout Session.
     * Pure logic: No database mutations happen here.
     */
    async handlePayment(
        order: IOrder
    ): Promise<PaymentHandlerResponse> {
        try {
            // DEBUG: Log order items before creating Stripe session
            console.log('[StripeService] Order Items:', order.items);
            console.log('[StripeService] Order Totals:', {
                subTotal: order.subTotal,
                tax: order.tax,
                deliveryFee: order.deliveryFee,
                totalAmount: order.totalAmount
            });

            const lineItems = order.items.map((item) => {
                const lineItem = {
                    price_data: {
                        currency: 'pkr',
                        product_data: {
                            name: item.name,
                            images: item.image ? [item.image] : [],
                            metadata: {
                                orderItemId: item.menuItem.toString(),
                            }
                        },
                        unit_amount: Math.round(item.price * 100),
                    },
                    quantity: item.quantity,
                };
                console.log(`[StripeService] Line Item: ${item.name} x${item.quantity} @ ₨${item.price}`);
                return lineItem;
            });

            // Tax & Delivery
            if (order.tax > 0) {
                lineItems.push({
                    price_data: { 
                        currency: 'pkr', 
                        product_data: { 
                            name: 'Tax',
                            images: [],
                            metadata: { orderItemId: 'tax' }
                        }, 
                        unit_amount: Math.round(order.tax * 100) 
                    },
                    quantity: 1,
                });
                console.log(`[StripeService] Line Item: Tax @ ₨${order.tax}`);
            }

            if (order.deliveryFee > 0) {
                lineItems.push({
                    price_data: { 
                        currency: 'pkr', 
                        product_data: { 
                            name: 'Delivery Fee',
                            images: [],
                            metadata: { orderItemId: 'delivery' }
                        }, 
                        unit_amount: Math.round(order.deliveryFee * 100) 
                    },
                    quantity: 1,
                });
                console.log(`[StripeService] Line Item: Delivery Fee @ ₨${order.deliveryFee}`);
            }

            console.log('[StripeService] Total Line Items for Stripe:', lineItems.length);
            console.log('[StripeService] Final Order Total:', order.totalAmount);

            const stripeSession = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL}/order-success?orderCode=${order.orderCode}`,
                cancel_url: `${process.env.FRONTEND_URL}/checkout`,
                metadata: {
                    orderId: order._id.toString(),
                    orderCode: order.orderCode,
                },
            });

            // Return response (Webhook will handle DB updates)
            return {
                success: true,
                order,
                checkoutUrl: stripeSession.url as string,
            };
        } catch (error: any) {
            console.error('[StripeService] Error creating session:', error.message);
            throw error;
        }
    }
}
