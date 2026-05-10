import { ClientSession, FilterQuery } from 'mongoose';
import OrderModel from '../models/Order';
import type { IOrder, OrderStatus } from '../models/Order';

// ─── Lean types ───────────────────────────────────────────────────────────────
// Re-export so callers never import from the model directly.
export type { IOrder };

// ─── Input shapes accepted by the repository ─────────────────────────────────
export interface CreateOrderData {
    user?: string;
    branchId: string;
    orderCode: string;
    items: IOrder['items'];
    orderType: IOrder['orderType'];
    tableNumber?: string;
    customerName?: string;
    phone?: string;
    deliveryAddress: IOrder['deliveryAddress'];
    paymentMethod: IOrder['paymentMethod'];
    subTotal: number;
    tax: number;
    deliveryFee: number;
    totalAmount: number;
    specialInstructions?: string;
    expiresAt: Date;
    paymentStatus?: IOrder['paymentStatus'];
    statusHistory?: IOrder['statusHistory'];
    waiterFlow?: IOrder['waiterFlow'];
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    totalPages: number;
    currentPage: number;
}

// ─── OrderRepository ──────────────────────────────────────────────────────────

export class OrderRepository {

    /** Persist a new order document inside an optional session. */
    static async create(
        data: CreateOrderData,
        session?: ClientSession,
    ): Promise<IOrder> {
        const [order] = await OrderModel.create(
            [
                {
                    user: data.user ?? undefined,
                    branchId: data.branchId,
                    orderCode: data.orderCode,
                    items: data.items,
                    orderType: data.orderType,
                    tableNumber: data.tableNumber,
                    customerName: data.customerName,
                    phone: data.phone,
                    deliveryAddress: data.deliveryAddress,
                    paymentMethod: data.paymentMethod,
                    subTotal: data.subTotal,
                    tax: data.tax,
                    deliveryFee: data.deliveryFee,
                    totalAmount: data.totalAmount,
                    paymentStatus: 'pending',
                    orderStatus: 'CREATED',
                    statusHistory: data.statusHistory ?? [],
                    specialInstructions: data.specialInstructions,
                    expiresAt: data.expiresAt,
                    waiterFlow: data.waiterFlow,
                },
            ],
            { session: session ?? undefined },
        );
        return order;
    }

    /** Find a single order by its Mongoose _id, scoped to a branch. */
    static async findByIdAndBranch(
        orderId: string,
        branchId: string,
        session?: ClientSession,
    ): Promise<IOrder | null> {
        const q = OrderModel.findOne({ _id: orderId, branchId: branchId });
        if (session) q.session(session);
        return q.exec();
    }

    /** Find one order by arbitrary filter. */
    static async findOne(
        filter: FilterQuery<IOrder>,
        session?: ClientSession,
    ): Promise<IOrder | null> {
        const q = OrderModel.findOne(filter);
        if (session) q.session(session);
        return q.exec();
    }

    /** Find an order by orderCode (public status polling). */
    static async findByCode(orderCode: string): Promise<Partial<IOrder> | null> {
        const raw = await OrderModel
            .findOne({ orderCode })
            .select('orderStatus updatedAt orderCode paymentStatus isPaid')
            .lean()
            .exec();
        return raw as unknown as Partial<IOrder> | null;
    }

    /** Find a fully-populated order by _id (admin / user detail view). */
    static async findByIdPopulated(orderId: string): Promise<IOrder | null> {
        return OrderModel
            .findById(orderId)
            .populate('user', 'name email phone')
            .populate('branchId', 'name location contactNumber email')
            .populate('items.menuItem')
            .exec();
    }

    /** Hybrid lookup: find by _id (if valid ObjectId) or orderCode. */
    static async findByIdOrCode(identifier: string): Promise<IOrder | null> {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

        const filter = isObjectId
            ? { $or: [{ _id: identifier }, { orderCode: identifier }] }
            : { orderCode: identifier };

        return OrderModel
            .findOne(filter)
            .populate('user', 'name email phone')
            .populate('branchId', 'name location contactNumber email')
            .populate('items.menuItem')
            .exec();
    }

    /** Paginated list of orders for a specific user. */
    static async findByUser(
        userId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<IOrder>> {
        const offset = (page - 1) * limit;
        const filter = { user: userId };

        const [total, rawItems] = await Promise.all([
            OrderModel.countDocuments(filter),
            OrderModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec(),
        ]);
        const items = rawItems as unknown as IOrder[];

        return { items, total, totalPages: Math.ceil(total / limit), currentPage: page };
    }

    /** Paginated + searchable list (admin). */
    static async findAll(
        page: number,
        limit: number,
        search: string,
        customFilter: FilterQuery<IOrder> = {}
    ): Promise<PaginatedResult<IOrder>> {
        const offset = (page - 1) * limit;

        // Merge search regex with our RBAC/Branch filter
        const filter = search
            ? { ...customFilter, $or: [{ orderCode: { $regex: search, $options: 'i' } }] }
            : customFilter;

        const [total, rawItems] = await Promise.all([
            OrderModel.countDocuments(filter),
            OrderModel.find(filter)
                .populate('user', 'name email phone')
                .populate('chefAssignment.chefId', 'name onDuty activeOrdersCount maxCapacity')
                .populate('waiterFlow.createdBy', 'name')
                .populate('waiterFlow.servedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec(),
        ]);
        const items = rawItems as unknown as IOrder[];

        return { items, total, totalPages: Math.ceil(total / limit), currentPage: page };
    }

    /** Find expired, unpaid orders that haven't yet been cancelled. */
    static async findExpired(
        statusIn: OrderStatus[],
    ): Promise<IOrder[]> {
        const raw = await OrderModel.find({
            paymentStatus: 'pending',
            paymentMethod: { $in: ['STRIPE', 'BANK'] },
            expiresAt: { $lt: new Date() },
            orderStatus: { $in: statusIn },
        }).lean().exec();
        return raw as unknown as IOrder[];
    }

    /** Bulk-cancel matching expired orders. Returns count of cancelled docs. */
    static async bulkCancelExpired(): Promise<number> {
        const result = await OrderModel.updateMany(
            {
                paymentStatus: 'pending',
                paymentMethod: { $in: ['STRIPE', 'BANK'] },
                expiresAt: { $lt: new Date() },
                orderStatus: { $ne: 'CANCELLED' },
            },
            { $set: { orderStatus: 'CANCELLED', paymentStatus: 'failed' } },
        );
        return result.modifiedCount;
    }

    /** Save changes to an existing order document. */
    static async save(
        order: IOrder,
        session?: ClientSession,
    ): Promise<IOrder> {
        return order.save({ session });
    }

    /** Revenue aggregation for admin dashboard, scoped by branch if needed. */
    static async aggregateMonthlySales(filter: FilterQuery<IOrder> = {}) {
        return OrderModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    totalRevenue: { $sum: '$totalAmount' },
                    totalOrders: { $sum: 1 },
                    avgOrderValue: { $avg: '$totalAmount' },
                },
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 },
        ]);
    }

    /** Total paid revenue, scoped by branch if needed. */
    static async aggregateTotalRevenue(filter: FilterQuery<IOrder> = {}): Promise<number> {
        const [result] = await OrderModel.aggregate([
            { $match: { ...filter, paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        return result?.total ?? 0;
    }
}
