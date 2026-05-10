import { z } from 'zod';

/**
 * Restaurant API - Additional Validation Schemas
 * 
 * Use these templates to create Zod schemas for your other routes:
 * - Categories
 * - Menu Items
 * - Reviews
 * - Bookings
 * - Orders
 */

// ─── UTILITIES 
const safeJsonParse = (val: any) => {
    if (typeof val !== 'string') return val;
    try {
        return JSON.parse(val);
    } catch {
        return val;
    }
};

// ─── MONGODB OBJECTID VALIDATION 
/**
 * Validates MongoDB ObjectId format (24 hex characters)
 * Use for any route parameter that references a document ID
 * 
 * @example
 * router.get('/categories/:id', validate(idParamSchema, ValidationSource.PARAMS), getCategory);
 */
const mongoIdSchema = z
    .string()
    .length(24, 'Invalid ID: Must be exactly 24 characters.')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid menu item ID. Please clear your cart and add valid products.');

// ─── CATEGORY SCHEMAS 
/**
 * Creating a new category
 * 
 * @example
 * POST /api/categories
 * {
 *   "name": "Italian Cuisine",
 *   "description": "Traditional Italian dishes",
 *   "image": "https://...",
 *   "active": true
 * }
 */
const booleanSchema = z.preprocess((val) => {
    if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
    }
    return val;
}, z.coerce.boolean().default(true));

export const createCategorySchema = z.object({
    name: z
        .string()
        .min(1, 'Category name is required')
        .max(100, 'Category name must be less than 100 characters')
        .trim(),
    image: z
        .string()
        .url('Invalid image URL')
        .optional(),
    isActive: booleanSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Updating a category
 * All fields are optional
 */
export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ─── MENU ITEM SCHEMAS 
/**
 * Creating a menu item
 * 
 * @example
 * POST /api/menu
 * {
 *   "name": "Spaghetti Carbonara",
 *   "description": "Classic Italian pasta with cream sauce",
 *   "price": 12.99,
 *   "category": "507f1f77bcf86cd799439011",  // MongoDB ID
 *   "image": "https://...",
 *   "ingredients": ["pasta", "eggs", "bacon", "cheese"],
 *   "spicy": "low",
 *   "preparationTime": 20
 * }
 */
export const createMenuItemSchema = z.object({
    name: z
        .string()
        .min(1, 'Menu item name is required')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
    description: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(500, 'Description must be less than 500 characters')
        .trim(),
    price: z.coerce.number().positive('Price must be greater than 0').max(9999.99, 'Price is too high'),
    category: mongoIdSchema,
    ingredients: z
        .preprocess(safeJsonParse, z.array(z.string()))
        .optional(),
    spicy: z
        .enum(['low', 'medium', 'high'])
        .optional(),
    isVegetarian: booleanSchema.default(false),
    preparationTime: z.coerce.number().int().positive().optional(),
    isAvailable: booleanSchema,
    featured: booleanSchema.default(false),
    isDeal: booleanSchema.default(false),
    dealPrice: z.coerce.number().positive().optional(),
    stock: z.coerce.number().int().min(0).optional(),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

/**
 * Updating a menu item
 */
export const updateMenuItemSchema = createMenuItemSchema.partial();
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

// ─── REVIEW SCHEMAS 
/**
 * Creating a review
 * 
 * @example
 * POST /api/reviews
 * {
 *   "menuItemId": "507f1f77bcf86cd799439011",
 *   "rating": 5,
 *   "review": "Best pasta I've ever had!"
 * }
 */
export const createReviewSchema = z.object({
    menuItemId: mongoIdSchema,
    rating: z
        .number()
        .int()
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating must be at most 5'),
    review: z
        .string()
        .min(2, 'Review must be at least 2 characters')
        .max(500, 'Review must be less than 500 characters')
        .trim(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * Updating a review
 */
export const updateReviewSchema = createReviewSchema.partial();
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

// ─── TABLE BOOKING SCHEMAS 
/**
 * Creating a table booking
 * 
 * @example
 * POST /api/bookings
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "phone": "1234567890",
 *   "guests": 4,
 *   "date": "2024-03-15T19:00:00Z",
 *   "time": "19:00",
 *   "tableType": "window",
 *   "specialRequest": "Window seat please"
 * }
 */
export const createBookingSchema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
    email: z
        .string()
        .email('Invalid email address')
        .toLowerCase()
        .trim(),
    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    guests: z
        .number()
        .int()
        .min(1, 'Must book for at least 1 person')
        .max(20, 'Maximum 20 people per booking'),
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    time: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
    branchId: mongoIdSchema.optional(),
    tableType: z
        .string()
        .optional(),
    tableId: mongoIdSchema.optional(),
    duration: z.coerce.number().int().min(30, 'Duration must be at least 30 minutes').max(480, 'Duration cannot exceed 8 hours').optional(),
    specialRequest: z
        .string()
        .max(500, 'Special request must be less than 500 characters')
        .trim()
        .optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Updating booking status
 */
export const updateBookingStatusSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

/**
 * Checking available bookings/tables
 * 
 * Query parameters:
 * - date (required): YYYY-MM-DD format
 * - branchId (required): MongoDB ObjectId
 * - guests (required): number of guests
 * - time (optional): HH:mm format
 * - duration (optional): minutes
 * 
 * @example
 * GET /api/bookings/available?date=2026-04-15&branchId=507f...&guests=4&time=19:30&duration=120
 */
export const getAvailableSlotsSchema = z.object({
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    branchId: mongoIdSchema.optional(),
    guests: z.coerce
        .number()
        .int()
        .min(1, 'Must book for at least 1 person')
        .max(20, 'Maximum 20 people per booking'),
    time: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)')
        .optional(),
    duration: z.coerce
        .number()
        .int()
        .min(30, 'Duration must be at least 30 minutes')
        .max(480, 'Duration cannot exceed 8 hours')
        .optional(),
});

export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;

/**
 * Getting time slots for a date
 * 
 * Query parameters:
 * - date (required): YYYY-MM-DD format
 * - branchId (required): MongoDB ObjectId
 * - guests (required): number of guests
 * - duration (optional): minutes, defaults to 30
 * 
 * @example
 * GET /api/bookings/time-slots?date=2026-04-15&branchId=507f...&guests=4&duration=120
 */
export const getTimeSlotsSchema = z.object({
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    branchId: mongoIdSchema.optional(),
    guests: z.coerce
        .number()
        .int()
        .min(1, 'Must book for at least 1 person')
        .max(20, 'Maximum 20 people per booking'),
    duration: z.coerce
        .number()
        .int()
        .min(30, 'Duration must be at least 30 minutes')
        .max(480, 'Duration cannot exceed 8 hours')
        .optional(),
});

export type GetTimeSlotsInput = z.infer<typeof getTimeSlotsSchema>;

// ─── ORDER SCHEMAS 
/**
 * Creating an order
 * 
 * @example
 * POST /api/orders
 * {
 *   "items": [
 *     { "menuItemId": "507f...", "quantity": 2 },
 *     { "menuItemId": "507f...", "quantity": 1 }
 *   ],
 *   "deliveryAddress": "123 Main St, City, State 12345",
 *   "paymentMethod": "card",
 *   "orderCode": "ORD-123456"
 * }
 */
// ─── ORDER SCHEMAS 
const normalizePaymentMethod = (method: string) => {
    const map: Record<string, string> = {
        cash_on_delivery: 'COD',
        cod: 'COD',
        stripe: 'STRIPE',
        card: 'STRIPE',
        bank_transfer: 'BANK',
        bank: 'BANK',
    };
    return map[method?.toLowerCase()] || method;
};

export const orderItemSchema = z.object({
    menuItemId: mongoIdSchema,
    quantity: z
        .number()
        .int()
        .min(1, 'Quantity must be at least 1')
        .max(100, 'Quantity must be at most 100'),
});

export const createOrderSchema = z.object({
    items: z
        .array(orderItemSchema)
        .min(1, 'Order must contain at least one item'),
    orderType: z.enum(['dinein', 'takeaway', 'online']).default('online'),
    tableNumber: z.string().optional(),
    customerName: z.string().optional(),
    phone: z.string().optional(),
    deliveryAddress: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
    }),
    paymentMethod: z
        .string()
        .transform(normalizePaymentMethod)
        .refine((val) => ['COD', 'STRIPE', 'BANK'].includes(val), {
            message: 'Invalid payment method. Expected COD, STRIPE, or BANK.',
        }),
    specialInstructions: z
        .string()
        .max(500, 'Special instructions must be less than 500 characters')
        .trim()
        .optional(),
    orderCode: z.string().min(1, 'Order code is required'),
    restaurantId: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Updating order status
 */
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
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// ─── CHEF SCHEMAS 
/**
 * Creating a chef
 */
export const createChefSchema = z.object({
    name: z.string().min(2).max(100),
    role: z.string().min(2).max(100),
    bio: z.string().min(10).max(1000).optional(),
    experience: z.string().optional(),
    specialties: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.string())).optional(),
    signatureDishes: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.any())).optional(),
    awards: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.string())).optional(),
    socialLinks: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.record(z.string(), z.string())).optional(),
    isActive: booleanSchema,
});

/**
 * Updating a chef
 */
export const updateChefSchema = createChefSchema.partial();

// ─── QUERY PAGINATION SCHEMAS 
/**
 * For GET endpoints with pagination
 * 
 * @example
 * GET /api/menu?page=1&limit=10&sort=-createdAt&search=pasta
 */
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    sort: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

// ─── ID PARAMETER SCHEMA 
/**
 * For routes with :id parameter
 * 
 * @example
 * router.get('/:id', validate(idParamSchema, ValidationSource.PARAMS), getById);
 */
export const idParamSchema = z.object({
    id: mongoIdSchema,
});

export type IdParamInput = z.infer<typeof idParamSchema>;

// ─── FILTER SCHEMAS 
/**
 * Menu filter query
 * 
 * @example
 * GET /api/menu?category=507f...&spicy=high&vegetarian=true
 */
export const menuFilterQuerySchema = z.object({
    category: mongoIdSchema.optional(),
    spicy: z.enum(['low', 'medium', 'high']).optional(),
    vegetarian: z
        .string()
        .transform((val) => val === 'true')
        .optional(),
    minPrice: z
        .string()
        .regex(/^\d+\.?\d*$/, 'minPrice must be a number')
        .transform((val) => parseFloat(val))
        .optional(),
    maxPrice: z
        .string()
        .regex(/^\d+\.?\d*$/, 'maxPrice must be a number')
        .transform((val) => parseFloat(val))
        .optional(),
});

export type MenuFilterQueryInput = z.infer<typeof menuFilterQuerySchema>;

/**
 * Order filter query
 * 
 * @example
 * GET /api/orders?status=pending&startDate=2024-03-01&endDate=2024-03-10
 */
export const orderFilterQuerySchema = z.object({
    status: z.enum([
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
    ]).optional(),
    startDate: z
        .string()
        .datetime()
        .optional(),
    endDate: z
        .string()
        .datetime()
        .optional(),
});

export type OrderFilterQueryInput = z.infer<typeof orderFilterQuerySchema>;
