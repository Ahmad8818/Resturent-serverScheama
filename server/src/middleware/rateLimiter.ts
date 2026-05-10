import rateLimit from 'express-rate-limit';

/** Applied only to auth routes – prevents brute-force attacks */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        statusCode: 429,
        message: 'Too many requests from this IP address. Please try again in 15 minutes.',
    },
});

/** Global API limiter */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        statusCode: 429,
        message: 'Too many requests. Please slow down.',
    },
});
