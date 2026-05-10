import { Request, Response } from 'express';
import stripe from '../config/stripe';
import OrderModel from '../models/Order';
import asyncHandler from '../utils/asyncHandler';
import { InventoryService } from '../services/inventoryService';

export const handleStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[Webhook] CRITICAL: STRIPE_WEBHOOK_SECRET is missing');
        return res.status(400).send('Webhook configuration missing');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        console.error(`[Webhook] ERROR: Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Webhook] Received event: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const sessionPayload = event.data.object as any;

                // 1. RE-FETCH SESSION FROM STRIPE (Security: Source of Truth)
                const session = await stripe.checkout.sessions.retrieve(sessionPayload.id, {
                    expand: ['payment_intent']
                });

                const { orderId, orderCode } = session.metadata || {};
                if (!orderId) {
                    console.error('[Webhook] ERROR: Missing orderId in session metadata');
                    return res.status(200).json({ received: true });
                }

                // 2. ATOMIC IDEMPOTENCY CHECK & LOCK
                // Only find order if it's NOT already paid
                const order = await OrderModel.findOneAndUpdate(
                    { _id: orderId, paymentStatus: { $ne: 'paid' } },
                    { $set: { updatedAt: new Date() } }, // Touch document to lock/signal intent
                    { new: true }
                );

                if (!order) {
                    console.log(`[Webhook] INFO: Order ${orderCode} already processed or missing. Skipping.`);
                    return res.status(200).json({ received: true });
                }

                // 3. VALIDATE PAYMENT STATUS
                if (session.payment_status !== 'paid') {
                    console.warn(`[Webhook] WARNING: Session for ${orderCode} is not paid. Status: ${session.payment_status}`);
                    return res.status(200).json({ received: true });
                }

                // 4. PREVENT OVERSELLING: VALIDATE STOCK
                try {
                    await InventoryService.validateStockForOrder(order);
                } catch (stockError: any) {
                    console.error(`[Webhook] CRITICAL: Stock validation failed for ${orderCode} AFTER payment.`);

                    // AUTO-REFUND Logic
                    if (session.payment_intent) {
                        const piId = typeof session.payment_intent === 'string'
                            ? session.payment_intent
                            : (session.payment_intent as any).id;

                        await stripe.refunds.create({
                            payment_intent: piId,
                            reason: 'requested_by_customer', // Best fit for stock issues
                            metadata: { reason: 'Insufficient Stock', orderCode }
                        });
                        console.log(`[Webhook] REFUND TRIGGERED for ${orderCode} due to stock depletion.`);
                    }

                    // Mark Order Fail
                    order.paymentStatus = 'failed';
                    order.orderStatus = 'CANCELLED';
                    order.statusHistory.push({ status: 'CANCELLED', time: new Date() });
                    await order.save();
                    return res.status(200).json({ received: true });
                }

                // 5. ATOMIC DEDUCTION (Source of Truth)
                await InventoryService.deductStockForOrder(order);
                console.log(`[Webhook] STOCK DEDUCTED for ${orderCode}`);

                // 6. FINALIZE ORDER
                order.paymentStatus = 'paid';
                order.isPaid = true;
                order.paidAt = new Date();
                order.stripePaymentIntentId = typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : (session.payment_intent as any).id;
                order.stripeCheckoutSessionId = session.id;
                order.orderStatus = 'CONFIRMED';
                order.statusHistory.push({ status: 'CONFIRMED', time: new Date() });

                await order.save();
                console.log(`[Webhook] SUCCESS: Order ${orderCode} finalized.`);
                break;
            }

            case 'payment_intent.payment_failed': {
                const intent = event.data.object as any;
                const orderId = intent.metadata?.orderId;
                if (orderId) {
                    await OrderModel.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
                    console.log(`[Webhook] FAILED: Payment failed for Order ID ${orderId}`);
                }
                break;
            }

            default:
                console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }
    } catch (err: any) {
        console.error(`[Webhook] UNHANDLED ERROR processing event ${event.type}:`, err.message);
        return res.status(500).send('Internal Server Error');
    }

    res.json({ received: true });
});
