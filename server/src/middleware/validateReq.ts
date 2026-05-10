import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import AppError from '../utils/AppError';

/**
 * Which part of the request to validate.
 * Mirrors the existing ValidationSource enum in middleware/validate.ts
 * so new code can use either import path.
 */
export enum ValidationSource {
    BODY   = 'body',
    QUERY  = 'query',
    PARAMS = 'params',
}

/**
 * validateReq — typed request validation middleware factory.
 *
 * Validates the selected part of `req` against a Zod schema, replaces
 * the data with the parsed (and transformed) result, then calls `next()`.
 *
 * On failure it calls `next(AppError)` so the global error handler responds
 * with a structured 400 payload — no try/catch needed in the route file.
 *
 * Usage:
 * ```ts
 * router.post(
 *   '/',
 *   validateReq(createOrderSchema),                          // body (default)
 *   validateReq(orderIdParamSchema, ValidationSource.PARAMS),
 *   myController,
 * );
 * ```
 */
export const validateReq =
    (schema: ZodSchema, source: ValidationSource = ValidationSource.BODY) =>
    (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            const details = (result.error as ZodError).issues
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ');

            return next(new AppError(`Validation failed — ${details}`, 400));
        }

        // Write back the coerced / transformed data
        if (source === ValidationSource.BODY) {
            (req as unknown as Record<string, unknown>).body = result.data;
        } else if (source === ValidationSource.QUERY) {
            Object.keys(req.query).forEach(k => delete (req.query as Record<string, unknown>)[k]);
            Object.assign(req.query, result.data);
        } else {
            Object.keys(req.params).forEach(k => delete (req.params as Record<string, unknown>)[k]);
            Object.assign(req.params, result.data);
        }

        next();
    };

export default validateReq;
