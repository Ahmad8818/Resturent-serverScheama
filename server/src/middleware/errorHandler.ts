import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import AppError from '../utils/AppError';

// ─── Error Transformers ──────────────────────────────────────────────────────

const handleCastError = (err: MongooseError.CastError): AppError =>
    new AppError(`Invalid ${err.path}: ${err.value}.`, 400);

const handleDuplicateKeyError = (err: { keyValue: Record<string, unknown> }): AppError => {
    const value = Object.values(err.keyValue)[0];
    return new AppError(
        `Duplicate field value: "${value}". Please use another value.`,
        400,
    );
};

const handleValidationError = (err: MongooseError.ValidationError): AppError => {
    const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join('. ');
    return new AppError(`Validation failed: ${messages}`, 400);
};

const handleJWTError = (): AppError =>
    new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = (): AppError =>
    new AppError('Your token has expired. Please log in again.', 401);

// ─── Response Formatters ─────────────────────────────────────────────────────

const sendErrorDev = (err: AppError, res: Response): void => {
    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        data: {
            status: err.status,
            statusCode: err.statusCode,
            stack: err.stack,
            error: err,
        },
    });
};

const sendErrorProd = (err: AppError, res: Response): void => {
    if (err.isOperational) {
        // Trusted / known error – send message to client
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            data: null,
        });
    } else {
        // Unknown / programming error – don't leak details
        console.error('💥 PROGRAMMING ERROR:', err);
        res.status(500).json({
            success: false,
            message: 'Something went very wrong!',
            data: null,
        });
    }
};

// ─── Global Error Handler ────────────────────────────────────────────────────

const errorHandler = (
    err: AppError & { code?: number; keyValue?: Record<string, unknown> },
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    const statusCode = err.statusCode || 500;
    const status = err.status || 'error';

    // Create a mutable copy for manipulation
    const errorWithDefaults = Object.assign(err, { statusCode, status });

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(errorWithDefaults, res);
    } else {
        let error = { ...err, message: err.message } as AppError & {
            code?: number;
            keyValue?: Record<string, unknown>;
        };

        if (errorWithDefaults.name === 'CastError') error = handleCastError(errorWithDefaults as unknown as MongooseError.CastError);
        if (errorWithDefaults.code === 11000) error = handleDuplicateKeyError(errorWithDefaults as { keyValue: Record<string, unknown> });
        if (errorWithDefaults.name === 'ValidationError') error = handleValidationError(errorWithDefaults as unknown as MongooseError.ValidationError);
        if (errorWithDefaults.name === 'JsonWebTokenError') error = handleJWTError();
        if (errorWithDefaults.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, res);
    }
};

export default errorHandler;
