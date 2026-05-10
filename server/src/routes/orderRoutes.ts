import { Router } from 'express';
import {
    createOrder,
    getMyOrders, getOrder, getAllOrders,
    updateOrderStatus, getOrderStatus, getOrderStats,
    verifyBankTransfer, cleanupExpiredOrders, serveOrder,
} from '../controllers/orderController';
import { handleStripeWebhook } from '../controllers/webhookController';
import {
    assignChef, acceptOrder, startPreparing, markReady, rejectOrder
} from '../controllers/kitchenController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import upload from '../middleware/multer';
import validateReq, { ValidationSource } from '../middleware/validateReq';
import extractUser from '../middleware/extractUser';
import attachBranch from '../middleware/attachBranch';

// Domain-scoped Zod schemas
import {
    createOrderSchema,
    updateOrderStatusSchema,
    verifyBankTransferSchema,
    orderIdParamSchema,
} from '../schemas/order.schema';

const createOrderRouter = () => {
    const router = Router();

    // ── Stripe webhook — raw body required, registered before express.json() ──
    router.post('/stripe-webhook', handleStripeWebhook);

    // ── Public: create order (guest dine-in allowed) ──────────────────────────
    router.post(
        '/',
        extractUser,                                 // Optional auth
        attachBranch,                                // Resolve branch context
        upload.single('receipt'),                   // Bank Transfer proof upload
        validateReq(createOrderSchema),              // Body validation
        createOrder,
    );

    // ── Stripe-specific alias ─────────────────────────────────────────────────
    router.post(
        '/stripe-checkout',
        extractUser,
        attachBranch,
        validateReq(createOrderSchema),
        createOrder,
    );

    // ── Authenticated user ────────────────────────────────────────────────────
    router.get('/my-orders', protect, getMyOrders);

    // ── Admin endpoints ───────────────────────────────────────────────────────
    router.get('/stats', protect, restrictTo('admin', 'manager'), getOrderStats);
    router.get('/', protect, restrictTo('admin', 'manager', 'kitchen', 'waiter', 'delivery'), getAllOrders);

    router.post(
        '/cleanup-expired',
        protect,
        restrictTo('admin'),
        cleanupExpiredOrders,
    );

    // ── Public status polling (no auth — used by order-tracking page) ─────────
    router.get('/:id/status', getOrderStatus);

    // ── Single order detail ───────────────────────────────────────────────────
    router.get(
        '/:id',
        extractUser,
        validateReq(orderIdParamSchema, ValidationSource.PARAMS),
        getOrder,
    );

    // ── Admin/Manager: update status ──────────────────────────────────────────
    router.patch(
        '/:id/status',
        protect,
        restrictTo('admin', 'manager'),
        validateReq(orderIdParamSchema, ValidationSource.PARAMS),
        validateReq(updateOrderStatusSchema, ValidationSource.BODY),
        updateOrderStatus,
    );

    // ── Admin/Manager: approve / reject bank transfer ─────────────────────────
    router.patch(
        '/:id/verify-bank',
        protect,
        restrictTo('admin', 'manager'),
        validateReq(orderIdParamSchema, ValidationSource.PARAMS),
        validateReq(verifyBankTransferSchema, ValidationSource.BODY),
        verifyBankTransfer,
    );

    // ── Chef Assignment & Kitchen Workflow ────────────────────────────────────
    router.post('/:orderId/assign-chef', protect, restrictTo('admin', 'manager'), assignChef);
    router.patch('/:orderId/accept', protect, restrictTo('kitchen', 'chef'), acceptOrder);
    router.patch('/:orderId/start-preparing', protect, restrictTo('kitchen', 'chef'), startPreparing);
    router.patch('/:orderId/mark-ready', protect, restrictTo('kitchen', 'chef'), markReady);
    router.patch('/:orderId/reject', protect, restrictTo('kitchen', 'chef'), rejectOrder);

    // ── Waiter Workflow ───────────────────────────────────────────────────────
    router.patch('/:id/serve', protect, restrictTo('admin', 'manager', 'waiter'), serveOrder);

    return router;
};

export default createOrderRouter;
