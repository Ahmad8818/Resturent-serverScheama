import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

import OrderModel from '../models/Order';
import IdempotencyModel from '../models/Idempotency';
import OrderService from '../services/orderService';
import { OrderRepository } from '../repositories/order.repository';

// ─── POST /api/orders ──────────────────────────────────────────────────────────
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const {
        items,
        deliveryAddress,
        paymentMethod,
        specialInstructions,
        orderCode,
        restaurantId,
        branchId: bodyBranchId,
        orderType,
        tableNumber,
        customerName,
        phone,
    } = req.body;

    // Idempotency check: only if orderCode is provided, otherwise skip to prevent "order-undefined" collision
    const idempotencyKey = (req.headers['idempotency-key'] as string) || (orderCode ? `order-${orderCode}` : null);

    if (idempotencyKey) {
        const existing = await IdempotencyModel.findOne({ key: idempotencyKey });
        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'Order already processed (idempotency hit).',
                data: existing.responsePayload,
            });
        }
    }

    const paymentResponse = await OrderService.createBulletproofOrder({
        userId: req.user?._id?.toString(),
        userObject: req.user, // Pass the full user object for role-based tracking
        orderCode,
        branchId: (req.branchId || bodyBranchId || restaurantId) as string,
        items,
        deliveryAddress,
        paymentMethod: paymentMethod as 'COD' | 'STRIPE' | 'BANK',
        orderType: orderType as 'online' | 'dinein' | 'takeaway',
        tableNumber,
        customerName,
        phone,
        specialInstructions,
        receiptBuffer: req.file?.buffer,
    });

    if (idempotencyKey) {
        await IdempotencyModel.create({
            key: idempotencyKey,
            responsePayload: paymentResponse,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
    }

    res.status(201).json({
        success: true,
        message: paymentResponse.message || 'Order created successfully.',
        data: paymentResponse,
    });
});

// Alias — supports frontend's specific Stripe endpoint path
export const stripeCheckout = createOrder;

// ─── GET /api/orders/my-orders ─────────────────────────────────────────────────
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 8);

    const data = await OrderService.getUserOrders({
        userId: req.user!._id.toString(),
        page,
        limit,
    });

    res.status(200).json(new ApiResponse('My orders fetched successfully.', data));
});

// ─── GET /api/orders/:id ───────────────────────────────────────────────────────
export const getOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const order = await OrderRepository.findByIdOrCode(req.params.id as string);
    if (!order) return next(new AppError('Order not found.', 404));

    // Auth: own order or admin; guest dine-in (no user field) is public
    if (
        order.user &&
        order.user._id.toString() !== req.user?._id?.toString() &&
        req.user?.role !== 'admin'
    ) {
        return next(new AppError('You do not have permission to view this order.', 403));
    }

    res.status(200).json(new ApiResponse('Order fetched successfully.', order));
});

// ─── GET /api/orders (admin) ───────────────────────────────────────────────────
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const search = (req.query.search as string) || '';

    const data = await OrderService.getAllOrders({ userObject: req.user, page, limit, search });
    res.status(200).json(new ApiResponse('All orders fetched successfully.', data));
});

// ─── GET /api/orders/:id/status (public polling) ──────────────────────────────
export const getOrderStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const order = await OrderRepository.findByCode(req.params.id as string);
    if (!order) return next(new AppError('Order not found.', 404));

    res.status(200).json(new ApiResponse('Order status fetched.', {
        orderId: order.orderCode,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        isPaid: order.isPaid,
        updatedAt: order.updatedAt,
    }));
});

// ─── PATCH /api/orders/:id/status (admin) ─────────────────────────────────────
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { orderStatus } = req.body;
    const updated = await OrderService.updateOrderStatus({
        orderId: req.params.id as string,
        branchId: req.branchId as string,
        userObject: req.user as any,
        newStatus: orderStatus,
    });

    res.status(200).json(new ApiResponse(`Order status updated to '${orderStatus}'.`, updated));
});

// ─── PATCH /api/orders/:id/verify-bank (admin) ────────────────────────────────
export const verifyBankTransfer = asyncHandler(async (req: Request, res: Response) => {
    const { isApproved } = req.body;
    const order = await OrderService.verifyBankTransfer({
        orderId: req.params.id as string,
        branchId: req.branchId as string,
        isApproved: isApproved as boolean,
    });

    res.status(200).json(
        new ApiResponse(`Bank transfer ${isApproved ? 'approved' : 'rejected'}.`, order),
    );
});

// ─── POST /api/orders/cleanup-expired (admin / cron) ──────────────────────────
export const cleanupExpiredOrders = asyncHandler(async (_req: Request, res: Response) => {
    const count = await OrderService.cancelExpiredOrders();
    res.status(200).json(
        new ApiResponse(`Cancelled ${count} expired orders.`, { cancelledCount: count }),
    );
});

// ─── GET /api/orders/stats (admin) ────────────────────────────────────────────
export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await OrderService.getOrderStats(req.user);
    res.status(200).json(new ApiResponse('Order stats fetched.', stats));
});

// ─── PATCH /api/orders/:id/serve (waiter) ──────────────────────────────────────
export const serveOrder = asyncHandler(async (req: Request, res: Response) => {
    const updated = await OrderService.serveOrder(
        req.params.id as string,
        req.user!._id.toString(),
        req.branchId as string
    );

    res.status(200).json(new ApiResponse('Order marked as served.', updated));
});
