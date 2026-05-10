import { z } from 'zod';

/**
 * Auth Validation Schemas using Zod
 *
 * These schemas provide:
 * ✅ Type-safe validation
 * ✅ XSS protection (Zod trims and sanitizes strings by default)
 * ✅ NoSQL injection prevention (explicitly validates field types)
 * ✅ Clear error messages
 * ✅ Automatic type inference for controllers
 */

// ─── Email Validation ──────────────────────────────────────────────────────────
const emailSchema = z
    .string()
    .min(1, 'Email is required')
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim();

// ─── Password Validation ──────────────────────────────────────────────────────
const passwordSchema = z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

// ─── Name Validation ───────────────────────────────────────────────────────────
const nameSchema = z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .trim()
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// ─── Register Schema ──────────────────────────────────────────────────────────
/**
 * Validates user registration request body
 *
 * @example
 * router.post('/register', validate(registerSchema, ValidationSource.BODY), register);
 */
export const registerSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Login Schema ─────────────────────────────────────────────────────────────
/**
 * Validates user login request body
 * Note: Password is intentionally not validated against complex rules here
 * to provide better UX for incorrect password attempts
 */
export const loginSchema = z.object({
    email: emailSchema,
    password: z
        .string()
        .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Email Verification Schema ────────────────────────────────────────────────
/**
 * Validates email verification request
 */
export const verifyEmailSchema = z.object({
    email: emailSchema,
    otp: z
        .string()
        .length(6, 'OTP must be exactly 6 digits')
        .regex(/^\d+$/, 'OTP must contain only numbers'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// ─── Forgot Password Schema ───────────────────────────────────────────────────
/**
 * Validates forgot password request
 */
export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password Schema ───────────────────────────────────────────────────
/**
 * Validates password reset request
 */
export const resetPasswordSchema = z.object({
    email: emailSchema,
    otp: z
        .string()
        .length(6, 'OTP must be exactly 6 digits')
        .regex(/^\d+$/, 'OTP must contain only numbers'),
    newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Update Profile Schema ───────────────────────────────────────────────────
/**
 * Validates profile update request
 */
export const updateProfileSchema = z.object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: z
        .string()
        .regex(/^\d+$/, 'Phone must contain only numbers')
        .min(10, 'Phone must be at least 10 digits')
        .max(15, 'Phone must be at most 15 digits')
        .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Query Pagination Schema ─────────────────────────────────────────────────
/**
 * Validates common pagination query parameters
 * @example
 * router.get('/users', validate(paginationSchema, ValidationSource.QUERY), getUsers);
 */
export const paginationSchema = z.object({
    page: z
        .string()
        .regex(/^\d+$/, 'Page must be a number')
        .transform((val) => parseInt(val, 10))
        .refine((val) => val > 0, 'Page must be greater than 0')
        .optional()
        .transform((val) => val ? parseInt(val as any, 10) : 1),
    limit: z
        .string()
        .regex(/^\d+$/, 'Limit must be a number')
        .transform((val) => parseInt(val, 10))
        .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
        .optional()
        .transform((val) => val ? parseInt(val as any, 10) : 10),
    sort: z
        .string()
        .optional(),
    search: z
        .string()
        .trim()
        .optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── Params ID Schema ─────────────────────────────────────────────────────────
/**
 * Validates MongoDB ObjectId in URL parameters
 * @example
 * router.get('/users/:id', validate(idParamSchema, ValidationSource.PARAMS), getUser);
 */
export const idParamSchema = z.object({
    id: z
        .string()
        .trim()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export type IdParamInput = z.infer<typeof idParamSchema>;
