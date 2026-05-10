import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { globalLimiter } from './middleware/rateLimiter';
import errorHandler from './middleware/errorHandler';
import AppError from './utils/AppError';

import authRoutes from './routes/authRoutes';
import categoryRoutes from './routes/categoryRoutes';
import menuRoutes from './routes/menuRoutes';
import reviewRoutes from './routes/reviewRoutes';
import bookingRoutes from './routes/bookingRoutes';
import branchRoutes from './routes/branchRoutes';
import chefRoutes from './routes/chefRoutes';
import createOrderRouter from './routes/orderRoutes';
import userRoutes from './routes/userRoutes';
import tableRoutes from './routes/tableRoutes';
import attachBranch from './middleware/attachBranch';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION-GRADE EXPRESS + TYPESCRIPT BACKEND
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ✅ Removed: xss-clean (causes read-only property errors in modern Express)
 * ✅ Removed: express-mongo-sanitize (tries to mutate read-only req.query)
 * ✅ Added: Zod validation middleware (type-safe, schema-based validation)
 *
 * This approach is MORE SECURE because:
 * 1. Explicitly validates input types (prevents injection attacks)
 * 2. Type-safe (catches errors at compile time with TypeScript)
 * 3. Automatic trimming and transformation of inputs
 * 4. No mutations of immutable objects
 * 5. Clear validation rules per endpoint
 *
 * MIDDLEWARE ORDER (CRITICAL for Express):
 * 1. CORS (must be first)
 * 2. Stripe Webhook (raw body)
 * 3. Helmet (security headers)
 * 4. Rate Limiting
 * 5. Body Parsers (json, urlencoded)
 * 6. Cookie Parser
 * 7. Logger (Morgan)
 * 8. Routes
 * 9. Error Handler (must be last)
 */

export const createApp = () => {
    const app = express();

    // ─── CORS (FIRST - must be before other middleware) ────────────────────────
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        process.env.ADMIN_URL || 'http://localhost:5174',
    ];

    app.use(
        cors({
            origin: allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }),
    );
    // Handle preflight requests for all routes
    app.options(/.*/, cors());

    // ─── Stripe Webhook (MUST receive raw body BEFORE express.json) ────────────
    app.use(
        '/api/orders/stripe-webhook',
        express.raw({ type: 'application/json' }),
    );

    // ─── Security Middleware (HELMET) ──────────────────────────────────────────
    // Helmet sets various HTTP headers for security
    // Run before body parsers
    app.use(
        helmet({
            crossOriginResourcePolicy: false,
            crossOriginEmbedderPolicy: false,
        }),
    );

    // ─── Rate Limiting ─────────────────────────────────────────────────────────
    // Apply rate limiting globally
    // Routes can also have specific limiters (e.g., authLimiter for login attempts)
    app.use(globalLimiter);

    // ─── Body Parsers (JSON & URL-encoded) ────────────────────────────────────
    // Parse incoming JSON requests
    app.use(express.json({ limit: '10mb' }));
    // Parse URL-encoded form data
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ─── Cookie Parser ────────────────────────────────────────────────────────
    // Parse cookies for authenticated requests
    app.use(cookieParser());

    // ─── Attach Branch Context (Centralized Tenancy) ──────────────────────────
    // Resolves branchId from headers, body, or defaults
    app.use(attachBranch);

    // ─── Logger (Morgan - development only) ───────────────────────────────────
    // Log HTTP requests in development
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ NOTE: Input validation happens PER ROUTE using Zod middleware
    //
    // This approach is BETTER than global xss-clean or mongo-sanitize:
    //    1. Explicitly define what each endpoint accepts
    //    2. Type-safe validation with TypeScript
    //    3. Automatic trimming and transformation of inputs
    //    4. No mutation of immutable request objects (req.query is read-only)
    //    5. Clear, maintainable, endpoint-specific security rules
    //    6. Prevents both XSS and NoSQL injection by validating types
    //
    // EXAMPLE:
    //    router.post(
    //        '/register',
    //        validate(registerSchema, ValidationSource.BODY),
    //        register
    //    );
    // ─────────────────────────────────────────────────────────────────────────

    // ─── Health Check ─────────────────────────────────────────────────────────
    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({
            status: 'success',
            message: '🍽️ Restaurant API is running',
            version: '1.0.0',
        });
    });

    app.get('/api/health', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'success', uptime: process.uptime() });
    });

    // ─── API Routes ───────────────────────────────────────────────────────────
    app.use('/api/auth', authRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/menu', menuRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/orders', createOrderRouter());
    app.use('/api/branches', branchRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/chefs', chefRoutes);
    app.use('/api/tables', tableRoutes);
    app.use('/api/users', userRoutes);

    // ─── 404 Handler ─────────────────────────────────────────────────────────
    app.use((req: Request, _res: Response, next: NextFunction) => {
        next(new AppError(`Route ${req.originalUrl} not found on this server.`, 404));
    });

    // ─── Global Error Handler (MUST be last) ────────────────────────────────
    app.use(errorHandler);

    return app;
};
