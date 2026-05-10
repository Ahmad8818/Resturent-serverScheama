import mongoose from 'mongoose';
import AppError from '../utils/AppError';
import { PaymentStrategy } from './payment/paymentStrategy';
import { InventoryService } from './inventoryService';
import AuditLogModel from '../models/AuditLog';
import { isValidObjectId } from '../utils/mongoose';
import { enforceBranchScope, canRoleTransition } from '../middleware/rbac.middleware';

// Repositories
import { OrderRepository } from '../repositories/order.repository';
import { MenuRepository } from '../repositories/menu.repository';
import { UserRepository } from '../repositories/user.repository';
import { ChefService } from './kitchenService';
import BranchModel from '../models/Branch';

// Domain
import { calculateOrderTotals } from '../domain/order/order.calculator';
import { canTransition, hadStockDeducted } from '../domain/order/order.state-machine';
import { generateUniqueOrderId } from '../utils/orderIdGenerator';

// Types
import type { IOrder } from '../models/Order';
import type { OrderStatus } from '../domain/order/order.state-machine';
import { IUser } from '../models/User';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateOrderInput {
    userObject?: IUser; // Full user object if authenticated
    userId?: string; // Legacy support or guest
    orderCode?: string;
    branchId: string;
    items: Array<{
        menuItemId: string;
        quantity: number;
        spiceLevel?: string;
        addons?: string[];
    }>;
    deliveryAddress: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    paymentMethod: 'COD' | 'STRIPE' | 'BANK';
    orderType: 'online' | 'dinein' | 'takeaway';
    tableNumber?: string;
    customerName?: string;
    phone?: string;
    specialInstructions?: string;
    receiptBuffer?: Buffer;
}

export interface UpdateOrderStatusInput {
    orderId: string;
    branchId: string;
    userObject: IUser;
    newStatus: OrderStatus;
}

export interface VerifyBankTransferInput {
    orderId: string;
    branchId: string;
    isApproved: boolean;
}

export interface GetUserOrdersInput {
    userId: string;
    page: number;
    limit: number;
}

export interface GetAllOrdersInput {
    page: number;
    limit: number;
    search: string;
}

// ─── OrderService ─────────────────────────────────────────────────────────────

export default class OrderService {

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Cancels an order and rolls back inventory inside a dedicated transaction.
     * Extracted to avoid repeating the session-management boilerplate.
     */
    private static async _cancelWithRollback(
        order: IOrder,
        patchFn: (o: IOrder) => void,
    ): Promise<void> {
        try {
            await InventoryService.rollbackStockForOrder(order);
            patchFn(order);
            await OrderRepository.save(order);
        } catch (err) {
            throw err;
        }
    }

    // ── Order Creation ─────────────────────────────────────────────────────────

    /**
     * Creates an order (Serverless-compatible, Event-Driven flow).
     *
     * Flow:
     *  1. Fetch & price-lock menu items
     *  2. Build validated line items
     *  3. Calculate totals
     *  4. Persist order document (Status: pending)
     *  5. Update user history
     *  6. Handle Inventory/Payment based on method:
     *     - STRIPE: Just return checkout URL. Inventory happens in Webhook.
     *     - COD/BANK: Deduct inventory immediately + Complete payment request.
     */
    static async createBulletproofOrder(input: CreateOrderInput) {
        const branchId = input.branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;
        const { userObject } = input;

        // DEBUG: Log incoming items with quantities
        console.log('[OrderService] Received Cart Items:', input.items);
        console.log('[OrderService] Items Count:', input.items.length);
        input.items.forEach((item, idx) => {
            console.log(`  Item ${idx + 1}: menuItemId=${item.menuItemId}, quantity=${item.quantity}`);
        });

        if (!isValidObjectId(branchId)) {
            throw new AppError(`Invalid Branch ID format for order: ${branchId}`, 400);
        }

        // ── 1. Fetch & lock items ───────────────────────────────────────────
        const itemIds = input.items.map(i => i.menuItemId);
        const menuItems = await MenuRepository.findAvailableByIdsAndBranch(
            itemIds,
            branchId as string,
        );

        if (menuItems.length !== input.items.length) {
            // Find which item IDs were not returned (unavailable / wrong branch)
            const foundIds = new Set(menuItems.map(m => m._id.toString()));
            const missingIds = itemIds.filter(id => !foundIds.has(id));

            // Try to fetch the missing items without branch/availability filters
            // so we can give a better error message
            const missingItems = await MenuRepository.findByIds(missingIds);
            const missingNames = missingItems.map(m => m.name).join(', ');

            const detail = missingNames
                ? `The following item(s) are currently unavailable: ${missingNames}.`
                : 'One or more items are unavailable, invalid, or do not belong to this branch.';

            throw new AppError(detail, 400);
        }

        // ── 2. Build line items ─────────────────────────────────────────────
        const validatedItems = input.items.map(cartItem => {
            const mi = menuItems.find(m => m._id.toString() === cartItem.menuItemId)!;
            return {
                menuItem: mi._id,
                name: mi.name,
                image: mi.image?.url ?? '',
                quantity: cartItem.quantity,
                price: mi.price,
                spiceLevel: cartItem.spiceLevel ?? 'Normal',
                addons: cartItem.addons ?? [],
            };
        });

        // ── 3. Domain: calculate totals ─────────────────────────────────────
        const totals = calculateOrderTotals(validatedItems, input.orderType);

        const targetUser = userObject?._id || input.userId;

        // ── 4. Persist order ────────────────────────────────────────────────
        const branch = await BranchModel.findById(branchId);
        const branchName = branch?.name || 'ORD';
        const orderCode = await generateUniqueOrderId(branchName);

        const order = await OrderRepository.create({
            user: targetUser ? targetUser.toString() : undefined,
            branchId: branchId!,
            orderCode,
            items: validatedItems as IOrder['items'],
            orderType: input.orderType,
            tableNumber: input.tableNumber,
            customerName: input.customerName,
            phone: input.phone,
            deliveryAddress: input.deliveryAddress as IOrder['deliveryAddress'],
            paymentMethod: input.paymentMethod,
            subTotal: totals.subTotal,
            tax: totals.tax,
            deliveryFee: totals.deliveryFee,
            totalAmount: totals.totalAmount,
            specialInstructions: input.specialInstructions,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            paymentStatus: 'pending',
            statusHistory: [{ status: 'CREATED', time: new Date() }],
            waiterFlow: {
                createdBy: (userObject?._id || input.userId) as any,
            }
        });

        // Track ownership for waiter/manager created orders
        if (userObject && userObject.role !== 'user') {
            order.createdBy = userObject._id;
            await order.save();
        }

        // ── 5. Update user order history ────────────────────────────────────
        if (userObject) {
            await UserRepository.pushOrderHistory(userObject._id.toString(), order._id);
        }

        // ── 6. Handle stock & payment flow ──────────────────────────────────

        // COD: Deduct stock immediately (Synchronous/Pending payment)
        if (order.paymentMethod === 'COD') {
            await InventoryService.deductStockForOrder(order);
            console.log(`[OrderService] Stock deducted for COD order: ${order.orderCode}`);
        }

        // STRIPE: Deferred to webhook.
        // BANK:   Deferred to admin approval.

        const paymentResponse = await PaymentStrategy.processPayment(
            order,
            { receiptBuffer: input.receiptBuffer },
        );

        return paymentResponse;
    }

    // ── Read Operations ────────────────────────────────────────────────────────

    static async getUserOrders(input: GetUserOrdersInput) {
        const result = await OrderRepository.findByUser(input.userId, input.page, input.limit);
        return {
            orders: result.items,
            total: result.total,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
        };
    }

    static async getAllOrders(input: any) {
        const { userObject, page, limit, search } = input;

        // 1. Base filter with branch enforcement
        let filter: any = enforceBranchScope({ user: userObject } as any, {});

        // 2. Role-specific view restrictions
        if (userObject.role === 'waiter') {
            filter.createdBy = userObject._id;
        }
        if (userObject.role === 'delivery') {
            filter.assignedTo = userObject._id;
        }

        const result = await OrderRepository.findAll(page, limit, search, filter);
        return {
            orders: result.items,
            total: result.total,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
        };
    }

    static async getOrderStats(userObject: any) {
        // Enforce branch isolation for managers and staff
        const filter = enforceBranchScope({ user: userObject } as any, {});

        const [monthlySales, totalRevenue] = await Promise.all([
            OrderRepository.aggregateMonthlySales(filter),
            OrderRepository.aggregateTotalRevenue(filter),
        ]);
        return { monthlySales, totalRevenue };
    }

    // ── State Transitions ──────────────────────────────────────────────────────

    /**
     * Advances an order's status through the strict lifecycle state machine.
     *
     * - Tenant isolation: order must belong to `branchId`.
     * - Domain enforces allowed transitions (no skipping).
     * - Cancellation triggers stock rollback.
     */
    static async updateOrderStatus(input: UpdateOrderStatusInput): Promise<IOrder> {
        const { orderId, userObject, newStatus } = input;
        const branchId = input.branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;

        // 1. Fetch order with strict branch isolation
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(orderId);
        const idFilter = isObjectId ? { _id: orderId } : { orderCode: orderId };
        const filter = enforceBranchScope({ user: userObject } as any, idFilter);
        const order = await OrderRepository.findOne(filter);

        if (!order) {
            throw new AppError('Order not found or access denied for this branch.', 404);
        }

        // 2. Validate Domain transition (state jump)
        const transition = canTransition(order.orderStatus as OrderStatus, newStatus, order.orderType);
        if (!transition.allowed) {
            throw new AppError(transition.reason ?? 'Invalid status transition.', 400);
        }

        // 3. Validate Role-based transition overlay
        if (!canRoleTransition(userObject.role, newStatus)) {
            throw new AppError(`Access Denied: Role '${userObject.role}' cannot move orders into '${newStatus}'`, 403);
        }

        // 4. Case-specific checks (Delivery Assignment)
        if (userObject.role === 'delivery' && order.assignedTo?.toString() !== userObject._id.toString()) {
            throw new AppError('Access Denied: This delivery is not assigned to you.', 403);
        }

        const oldStatus = order.orderStatus;

        // 5. Update status and record operational timestamps
        order.orderStatus = newStatus;
        order.statusHistory.push({ status: newStatus, time: new Date() });

        if (newStatus === 'PREPARING') order.startedAt = new Date();
        if (newStatus === 'READY') order.readyAt = new Date();
        if (newStatus === 'DELIVERED') order.deliveredAt = new Date();

        // 6. Handle chef capacity decrement on completion
        const terminalStatuses: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'DELIVERED', 'SERVED', 'PICKED_UP'];
        if (terminalStatuses.includes(newStatus) && order.chefAssignment?.chefId && order.chefAssignment.acceptedAt) {
            await ChefService.decrementChefCount(order.chefAssignment.chefId.toString());
        }
        if (newStatus === 'COMPLETED' && order.orderType === 'online') order.deliveredAt = new Date();

        // 6. Finalize (Cancellation rollback or simple save)
        if (newStatus === 'CANCELLED') {
            await OrderService._cancelWithRollback(order, o => { o.orderStatus = newStatus; });
        } else {
            await OrderRepository.save(order);
        }

        // 7. Audit Logging
        await AuditLogModel.create({
            action: 'ORDER_STATUS_UPDATED',
            performedBy: userObject._id,
            branch: order.branchId,
            resourceType: 'ORDER',
            resourceId: order._id,
            details: {
                oldValue: oldStatus,
                newValue: newStatus,
                message: `Order status moved from ${oldStatus} to ${newStatus}`
            }
        });

        return order;
    }

    // ── Payment Operations ─────────────────────────────────────────────────────

    /**
     * Approves or rejects a manual bank transfer.
     * Hardened: Deducts stock ONLY on approval.
     */
    static async verifyBankTransfer(input: VerifyBankTransferInput): Promise<IOrder> {
        const { orderId, isApproved } = input;
        const branchId = input.branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;

        const isObjectId = /^[0-9a-fA-F]{24}$/.test(orderId);
        const idFilter = isObjectId ? { _id: orderId } : { orderCode: orderId };

        const order = await OrderRepository.findOne({
            ...idFilter,
            branchId: branchId,
            paymentMethod: 'BANK',
        });
        if (!order) {
            throw new AppError('Bank order not found or access denied for this branch.', 404);
        }

        if (isApproved) {
            // 1. Validate & Deduct Stock upon approval
            await InventoryService.validateStockForOrder(order);
            await InventoryService.deductStockForOrder(order);

            // 2. Mark as Paid
            order.paymentStatus = 'paid';
            order.isPaid = true;
            order.paidAt = new Date();
            console.log(`[OrderService] Bank transfer approved for ${order.orderCode}. Stock deducted.`);
            return OrderRepository.save(order);
        }

        // Rejected → cancel (no stock rollback needed as it was never deducted for BANK until now)
        order.paymentStatus = 'failed';
        order.orderStatus = 'CANCELLED';
        order.statusHistory.push({ status: 'CANCELLED', time: new Date() });
        return OrderRepository.save(order);
    }

    /**
     * Auto-cancels expired unpaid STRIPE / BANK orders (cron job).
     *
     * Orders that had progressed past 'pending' had stock deducted — those
     * get a rollback first. Orders still in 'pending' never touched inventory.
     */
    static async cancelExpiredOrders(): Promise<number> {
        // Roll back stock for orders that progressed into the kitchen
        const withStock = await OrderRepository.findExpired([
            'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY',
        ]);

        for (const order of withStock) {
            try {
                await InventoryService.rollbackStockForOrder(order as IOrder);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(
                    `[OrderService] Rollback failed for expired order ${order._id}: ${msg}`,
                );
            }
        }

        return OrderRepository.bulkCancelExpired();
    }

    /**
     * Marks a dine-in order as SERVED by a waiter.
     */
    static async serveOrder(orderId: string, waiterId: string, branchId: string): Promise<IOrder> {
        const order = await OrderRepository.findOne({
            _id: orderId,
            branchId,
            orderType: 'dinein'
        });

        if (!order) {
            throw new AppError('Dine-in order not found in this branch.', 404);
        }

        if (order.orderStatus !== 'READY') {
            throw new AppError(`Order cannot be served. Current status: ${order.orderStatus}. Expected: READY`, 400);
        }

        if (order.waiterFlow?.servedBy) {
            throw new AppError('Order has already been served.', 400);
        }

        order.orderStatus = 'SERVED';
        order.waiterFlow.servedBy = new mongoose.Types.ObjectId(waiterId);
        order.waiterFlow.servedAt = new Date();
        order.statusHistory.push({
            status: 'SERVED',
            time: new Date(),
            updatedBy: new mongoose.Types.ObjectId(waiterId)
        });

        return OrderRepository.save(order);
    }
}
