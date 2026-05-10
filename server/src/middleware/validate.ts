import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import AppError from '../utils/AppError';

/**
 * Validation source enum
 * Determines which part of the request to validate
 */
export enum ValidationSource {
    BODY = 'body',
    QUERY = 'query',
    PARAMS = 'params',
}

/**
 * Generic validation middleware factory
 * Creates a middleware function that validates request data against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param source - Which part of request to validate (body, query, or params)
 * @returns Express middleware function
 *
 * @example
 * // Validate request body
 * router.post('/register', validate(registerSchema, ValidationSource.BODY), registerController);
 *
 * // Validate query parameters
 * router.get('/users', validate(querySchema, ValidationSource.QUERY), getUsers);
 *
 * // Validate URL parameters
 * router.get('/users/:id', validate(idSchema, ValidationSource.PARAMS), getUser);
 */
export const validate =
    (schema: ZodSchema, source: ValidationSource = ValidationSource.BODY) =>
        (req: Request, _res: Response, next: NextFunction) => {
            try {
                // Get the data to validate based on source
                const dataToValidate = req[source];

                // Validate the data against the schema
                const validatedData = schema.parse(dataToValidate);

                // Replace the original data with validated (and possibly transformed) data
                // Only assign for body, query, and params (the mutable parts)
                if (source === ValidationSource.BODY) {
                    (req as any).body = validatedData;
                } else if (source === ValidationSource.QUERY) {
                    // Mutate req.query as it's often a getter and read-only
                    Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
                    Object.assign(req.query, validatedData);
                } else if (source === ValidationSource.PARAMS) {
                    // Mutate req.params for consistency
                    Object.keys(req.params).forEach(key => delete (req.params as any)[key]);
                    Object.assign(req.params, validatedData);
                }

                next();
            } catch (err) {
                if (err instanceof ZodError) {
                    // Format Zod errors into a user-friendly message
                    const formattedErrors = err.issues.map((error: any) => ({
                        field: error.path.join('.'),
                        message: error.message,
                        code: error.code,
                    }));

                    return next(
                        new AppError(
                            `Validation Error: ${formattedErrors.map((e: any) => `${e.field}: ${e.message}`).join('; ')}`,
                            400,
                        ),
                    );
                }

                // Handle unexpected errors
                // Handle unexpected errors (e.g. within preprocessors)
                next(new AppError(`Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 400));
            }
        };

export default validate;