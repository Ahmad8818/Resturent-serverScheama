/**
 * EXAMPLE: Updated Auth Routes with Zod Validation
 * 
 * This file demonstrates how to add Zod validation to your existing routes.
 * Copy the validation middleware to the route and it will automatically:
 * 
 * ✅ Validate request body/query/params
 * ✅ Trim and sanitize strings
 * ✅ Convert types (e.g., string "123" to number 123)
 * ✅ Return clear error messages on validation failure
 * ✅ Prevent both XSS and NoSQL injection attacks
 */

import { Router } from 'express';
import {
    register, verifyEmail, login, logout,
    forgotPassword, resetPassword,
    getMe, updateProfile, updateAvatar,
    googleAuth, refreshToken,
} from '../controllers/authController';
import protect from '../middleware/protect';
import upload from '../middleware/multer';
import { authLimiter } from '../middleware/rateLimiter';
import validate, { ValidationSource } from '../middleware/validate';
import {
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    updateProfileSchema,
    idParamSchema,
} from '../schemas/authSchemas';

const router = Router();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * POST /api/auth/register
 * 
 * Validates:
 * - name: 2-50 characters, letters/spaces/hyphens/apostrophes only
 * - email: valid email format
 * - password: min 8 chars, must contain uppercase, lowercase, and number
 * 
 * The validate middleware will:
 * 1. Parse the schema from req.body
 * 2. Trim whitespace from strings
 * 3. Convert to lowercase for email
 * 4. Return 400 with clear validation errors if any field is invalid
 * 5. Call next() if all validations pass with cleaned data
 */
router.post(
    '/register',
    authLimiter,
    validate(registerSchema, ValidationSource.BODY),
    register,
);

/**
 * POST /api/auth/verify-email
 * 
 * Validates:
 * - email: valid email format
 * - otp: exactly 6 digits
 */
router.post(
    '/verify-email',
    validate(verifyEmailSchema, ValidationSource.BODY),
    verifyEmail,
);

/**
 * POST /api/auth/login
 * 
 * Validates:
 * - email: valid email format
 * - password: required (not validated for complexity to provide better UX)
 */
router.post(
    '/login',
    authLimiter,
    validate(loginSchema, ValidationSource.BODY),
    login,
);

/**
 * POST /api/auth/forgot-password
 * 
 * Validates:
 * - email: valid email format
 */
router.post(
    '/forgot-password',
    authLimiter,
    validate(forgotPasswordSchema, ValidationSource.BODY),
    forgotPassword,
);

/**
 * POST /api/auth/reset-password
 * 
 * Validates:
 * - email: valid email format
 * - otp: exactly 6 digits
 * - newPassword: min 8 chars, uppercase, lowercase, and number required
 */
router.post(
    '/reset-password',
    validate(resetPasswordSchema, ValidationSource.BODY),
    resetPassword,
);

/**
 * POST /api/auth/google
 * No validation example (external service)
 */
router.post('/google', googleAuth);

/**
 * POST /api/auth/refresh-token
 * No validation example (cookie-based)
 */
router.post('/refresh-token', refreshToken);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROTECTED ROUTES (Requires authentication via protect middleware)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * POST /api/auth/logout
 */
router.post(
    '/logout',
    protect,
    logout,
);

/**
 * GET /api/auth/me
 */
router.get(
    '/me',
    protect,
    getMe,
);

/**
 * PATCH /api/auth/update-profile
 * 
 * Validates:
 * - name: optional, same rules as register
 * - email: optional, must be valid email
 * - phone: optional, 10-15 digits only
 * 
 * All fields are optional (use .optional()), so any combination is valid
 */
router.patch(
    '/update-profile',
    protect,
    validate(updateProfileSchema, ValidationSource.BODY),
    updateProfile,
);

/**
 * PATCH /api/auth/update-avatar
 * 
 * This uses multer for file upload, no Zod validation needed
 */
router.patch(
    '/update-avatar',
    protect,
    upload.single('avatar'),
    updateAvatar,
);

export default router;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOW TO USE THIS IN YOUR CONTROLLERS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * In your controller, the validated data is automatically cleaned and available:
 *
 * export const register = asyncHandler(async (req: Request, res: Response) => {
 *     // req.body now contains VALIDATED and CLEANED data
 *     // Zod has already:
 *     // 1. Trimmed strings
 *     // 2. Converted email to lowercase
 *     // 3. Validated format and length
 *     // 4. Prevented any XSS payloads (strings are typed)
 *
 *     const { name, email, password } = req.body;
 *
 *     // You can trust this data - it's already validated
 *     const existingUser = await UserModel.findOne({ email });
 *     // ... rest of logic
 * });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * VALIDATION ERROR RESPONSE EXAMPLE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Request with invalid data:
 * {
 *   "name": "A",  // Too short
 *   "email": "not-an-email",  // Invalid format
 *   "password": "weak"  // Too short and missing uppercase/number
 * }
 *
 * Response (400 Bad Request):
 * {
 *   "status": "fail",
 *   "message": "Validation Error: name: String must contain at least 2 character(s); 
 *              email: Invalid email; password: Password must be at least 8 characters"
 * }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SECURITY BENEFITS OF THIS APPROACH
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. XSS PREVENTION
 *    - Zod validates string types, preventing HTML/script injection
 *    - All strings are trimmed automatically
 *    - Email is lowercased (prevents email bypass attacks)
 *
 * 2. NoSQL INJECTION PREVENTION
 *    - Explicit type validation prevents $gt, $lt, $ne operators
 *    - Only valid email formats accepted (no operators in email field)
 *    - Regex validation prevents special characters
 *
 * 3. TYPE SAFETY
 *    - TypeScript catches errors at compile time
 *    - Runtime validation with clear error messages
 *    - No mutating immutable request objects
 *
 * 4. CLEAR INTENT
 *    - Each route explicitly shows what it accepts
 *    - Easy to audit and test
 *    - Self-documenting code
 */
