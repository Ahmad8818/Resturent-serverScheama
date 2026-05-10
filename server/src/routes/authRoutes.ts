import { Router } from 'express';
import {
    register, verifyEmail, login, logout,
    forgotPassword, resetPassword,
    getMe, updateProfile, updateAvatar,
    googleAuth, refreshToken, toggleDuty,
} from '../controllers/authController';
import protect from '../middleware/protect';
import upload from '../middleware/multer';
import { authLimiter } from '../middleware/rateLimiter';

import {
    registerSchema, loginSchema, verifyEmailSchema,
    forgotPasswordSchema, resetPasswordSchema,
    updateProfileSchema,
} from '../schemas/authSchemas';
import validate, { ValidationSource } from '../middleware/validate';

const router = Router();

// Public routes
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/google', googleAuth);
router.post('/refresh-token', refreshToken);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.patch('/update-profile', protect, validate(updateProfileSchema), updateProfile);
router.patch('/update-avatar', protect, upload.single('avatar'), updateAvatar);
router.patch('/toggle-duty', protect, toggleDuty);

export default router;
