import { z } from 'zod';

// ─── Shared primitives 

/** Validates a 24-hex-character MongoDB ObjectId. */
const mongoId = z
    .string()
    .length(24, 'Invalid ID: must be exactly 24 hex characters.')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format.');

/** Normalises common payment-method aliases sent by the frontend. */
const normalisePaymentMethod = (raw: string): string => {
    const map: Record<string, string> = {
        cash_on_delivery: 'COD',
        cod: 'COD',
        stripe: 'STRIPE',
        card: 'STRIPE',
        bank_transfer: 'BANK',
        bank: 'BANK',
    };
    return map[raw?.toLowerCase()] ?? raw;
};

// ─── createOrder 

export const orderItemSchema = z.object({
    menuItemId: mongoId,
    quantity: z
        .number()
        .int('Quantity must be a whole number.')
        .min(1, 'Quantity must be at least 1.')
        .max(100, 'Quantity cannot exceed 100.'),
    spiceLevel: z.string().optional(),
    addons: z.array(z.string()).optional(),
});

export const createOrderSchema = z.object({
    items: z
        .array(orderItemSchema)
        .min(1, 'Order must contain at least one item.'),

    orderType: z
        .enum(['dinein', 'takeaway', 'online'])
        .default('online'),

    tableNumber: z.string().optional(),
    customerName: z.string().optional(),
    phone: z.string().optional(),

    deliveryAddress: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
    }).optional().default({}),

    paymentMethod: z
        .string()
        .transform(normalisePaymentMethod)
        .refine(
            val => ['COD', 'STRIPE', 'BANK'].includes(val),
            { message: 'Invalid payment method. Accepted: COD, STRIPE, BANK.' },
        ),

    specialInstructions: z
        .string()
        .max(500, 'Special instructions cannot exceed 500 characters.')
        .trim()
        .optional(),

    orderCode: z
        .string()
        .min(1, 'Order code cannot be empty.')
        .optional(),

    branchId: mongoId.optional(),
    restaurantId: mongoId.optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;

// ─── updateOrderStatus 

export const updateOrderStatusSchema = z.object({
    orderStatus: z.enum([
        'CREATED',
        'CONFIRMED',
        'PREPARING',
        'READY',
        'SERVED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
    ]),
    restaurantId: mongoId.optional(),
});

export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusSchema>;

// ─── verifyBankTransfer 

export const verifyBankTransferSchema = z.object({
    isApproved: z.boolean(),
    restaurantId: mongoId.optional(),
});

export type VerifyBankTransferBody = z.infer<typeof verifyBankTransferSchema>;

// ─── getOrders (query) 

export const getOrdersQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
});

export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>;

// ─── :id route param 

export const orderIdParamSchema = z.object({
    id: z.string().min(1, 'Order ID/Code cannot be empty.'),
});

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
