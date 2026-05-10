import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IOrderItem {
    menuItem: Types.ObjectId;
    name: string;
    image: string;
    quantity: number;
    price: number;  // price locked at time of order
    spiceLevel?: string;
    addons?: string[];
}

export interface IDeliveryAddress {
    street: string;
    city: string;
    state: string;
    zipCode: string;
}

export type OrderStatus =
    | 'CREATED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'SERVED'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED';

export type PaymentMethod = 'COD' | 'STRIPE' | 'BANK';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface IOrder extends Document {
    _id: Types.ObjectId;
    orderCode: string;
    user?: Types.ObjectId;  // Optional for guest dine-in orders
    branchId: Types.ObjectId;
    orderType: 'dinein' | 'takeaway' | 'online';
    tableNumber?: string;
    customerName?: string;
    phone?: string;
    items: IOrderItem[];
    deliveryAddress: IDeliveryAddress;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    isPaid: boolean;
    paidAt?: Date;
    stripePaymentIntentId?: string;
    stripeCheckoutSessionId?: string;
    bankTransferProof?: {
        url: string;
        publicId: string;
    };
    orderStatus: OrderStatus;
    assignedTo?: Types.ObjectId;
    createdBy?: Types.ObjectId;
    priority: 'normal' | 'urgent';
    startedAt?: Date;
    readyAt?: Date;
    deliveredAt?: Date;
    chefAssignment?: {
        chefId: Types.ObjectId;
        assignedAt: Date;
        acceptedAt?: Date;
        startedPreparingAt?: Date;
        readyAt?: Date;
        rejected?: boolean;
    };
    waiterFlow?: {
        createdBy?: Types.ObjectId;
        servedBy?: Types.ObjectId;
        servedAt?: Date;
    };
    subTotal: number;
    tax: number;
    deliveryFee: number;
    totalAmount: number;
    statusHistory: {
        status: string;
        time: Date;
        updatedBy?: Types.ObjectId;
    }[];
    specialInstructions?: string;
    expiresAt?: Date; // For auto-cancellation of unpaid orders
    createdAt: Date;
    updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
    {
        menuItem: {
            type: Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: true,
        },
        name: { type: String, required: true },
        image: { type: String, required: true },
        quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
        price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
        spiceLevel: { type: String, default: 'Normal' },
        addons: { type: [String], default: [] },
    },
    { _id: false },
);

const deliveryAddressSchema = new Schema<IDeliveryAddress>(
    {
        street: { type: String, required: false },
        city: { type: String, required: false },
        state: { type: String, required: false },
        zipCode: { type: String, required: false },
    },
    { _id: false },
);

const orderSchema = new Schema<IOrder>(
    {
        orderCode: {
            type: String,
            required: [true, 'Order code is required'],
            unique: true,
            index: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'ResturentUser',
            required: false,  // Optional for guest dine-in orders
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: [true, 'Branch reference is required'],
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: (items: IOrderItem[]) => items.length > 0,
                message: 'Order must contain at least one item',
            },
        },
        orderType: {
            type: String,
            enum: ['dinein', 'takeaway', 'online'],
            required: [true, 'Order type is required'],
            default: 'online',
        },
        tableNumber: {
            type: String,
            required: false,
        },
        customerName: {
            type: String,
            required: false,
        },
        phone: {
            type: String,
            required: false,
        },
        deliveryAddress: {
            type: deliveryAddressSchema,
            required: false,
        },
        paymentMethod: {
            type: String,
            enum: ['COD', 'STRIPE', 'BANK'],
            required: [true, 'Payment method is required'],
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending',
        },
        isPaid: {
            type: Boolean,
            default: false,
        },
        paidAt: {
            type: Date,
        },
        stripePaymentIntentId: {
            type: String,
        },
        stripeCheckoutSessionId: {
            type: String,
        },
        bankTransferProof: {
            url: String,
            publicId: String,
        },
        orderStatus: {
            type: String,
            enum: ['CREATED', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
            default: 'CREATED',
        },
        statusHistory: [
            {
                status: { type: String, required: true },
                time: { type: Date, default: Date.now },
                updatedBy: { type: Schema.Types.ObjectId, ref: 'ResturentUser' }
            },
        ],
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'ResturentUser',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'ResturentUser',
        },
        priority: {
            type: String,
            enum: ['normal', 'urgent'],
            default: 'normal',
        },
        startedAt: Date,
        readyAt: Date,
        deliveredAt: Date,
        chefAssignment: {
            chefId: { type: Schema.Types.ObjectId, ref: 'ResturentUser' },
            assignedAt: { type: Date, default: Date.now },
            acceptedAt: Date,
            startedPreparingAt: Date,
            readyAt: Date,
            rejected: { type: Boolean, default: false }
        },
        waiterFlow: {
            createdBy: {
                type: Schema.Types.ObjectId,
                ref: 'ResturentUser',
                required: false,
            },
            servedBy: {
                type: Schema.Types.ObjectId,
                ref: 'ResturentUser',
            },
            servedAt: Date,
        },
        subTotal: {
            type: Number,
            required: [true, 'Sub-total is required'],
            min: [0, 'Sub-total cannot be negative'],
        },
        tax: {
            type: Number,
            required: true,
            default: 0,
        },
        deliveryFee: {
            type: Number,
            required: true,
            default: 0,
        },
        totalAmount: {
            type: Number,
            required: [true, 'Total amount is required'],
            min: [0, 'Total amount cannot be negative'],
        },
        specialInstructions: {
            type: String,
            maxlength: [500, 'Special instructions cannot exceed 500 characters'],
        },
        expiresAt: {
            type: Date, // TTL index can be added if needed: orderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
        }
    },
    { timestamps: true },
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ branchId: 1, orderStatus: 1 });
orderSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });
orderSchema.index({ stripeCheckoutSessionId: 1 }, { sparse: true });
orderSchema.index({ 'chefAssignment.chefId': 1 }, { sparse: true });
orderSchema.index({ orderCode: 1 }, { unique: true });

const OrderModel = mongoose.model<IOrder>('ResturentOrder', orderSchema);
export default OrderModel;
