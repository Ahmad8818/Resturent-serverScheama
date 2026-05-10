import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import UserModel from '../models/User';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/generateToken';
import { sendEmail, verifyEmailTemplate, forgotPasswordTemplate } from '../utils/email';
import { uploadImage, deleteImage } from '../services/cloudinaryService';
import admin from '../config/firebase';

// ─── Cookie Options ────────────────────────────────────────────────────────────
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none' as const,
};

// ─── POST /api/auth/register ───────────────────────────────────────────────────
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return next(new AppError('Please provide name, email, and password.', 400));
    }

    const existing = await UserModel.findOne({ email });
    if (existing) return next(new AppError('An account with this email already exists.', 409));

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await UserModel.create({
        name,
        email,
        password,
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000, // 10 min
    });

    await sendEmail({
        to: email,
        subject: 'Verify your email – Restaurant App',
        html: verifyEmailTemplate(name, otp),
    });

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    await UserModel.findByIdAndUpdate(user._id, { refresh_token: refreshToken });

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(201).json({
        success: true,
        message: 'Registered successfully! Please check your email to verify your account.',
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            accessToken,
        },
    });
});

// ─── POST /api/auth/verify-email ──────────────────────────────────────────────
export const verifyEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, otp } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) return next(new AppError('User not found.', 404));

    if (user.otp !== otp) return next(new AppError('Invalid OTP.', 400));
    if (!user.otpExpires || user.otpExpires < new Date())
        return next(new AppError('OTP has expired. Please request a new one.', 400));

    user.verify_email = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: 'Email verified successfully.',
        data: null,
    });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Please provide email and password.', 400));
    }

    const user = await UserModel.findOne({ email }).select('+password');
    if (!user) return next(new AppError('Invalid email or password.', 401));

    if (!user.verify_email)
        return next(new AppError('Please verify your email before logging in.', 401));

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) return next(new AppError('Invalid email or password.', 401));

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    const kitchenRoles = ['kitchen', 'chef'];
    const updateOnLogin: Record<string, any> = {
        last_login_date: new Date(),
        refresh_token: refreshToken,
    };
    if (kitchenRoles.includes(user.role)) {
        updateOnLogin.onDuty = true;
    }
    await UserModel.findByIdAndUpdate(user._id, updateOnLogin);

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                onDuty: user.role === 'kitchen' || user.role === 'chef' ? true : user.onDuty,
            },
            accessToken,
        },
    });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export const logout = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (userId) {
        const updateOnLogout: Record<string, any> = { refresh_token: '' };
        const kitchenRoles = ['kitchen', 'chef'];
        if (req.user && kitchenRoles.includes(req.user.role)) {
            updateOnLogout.onDuty = false;
        }
        await UserModel.findByIdAndUpdate(userId, updateOnLogout);
    }

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
        data: null,
    });
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });
    // Always respond with 200 to prevent email enumeration
    if (!user) {
        return res.status(200).json({
            success: true,
            message: 'If an account exists for this email, you will receive a reset OTP.',
            data: null,
        });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendEmail({
        to: email,
        subject: 'Password Reset OTP – Restaurant App',
        html: forgotPasswordTemplate(user.name, otp),
    });

    res.status(200).json({
        success: true,
        message: 'If an account exists for this email, you will receive a reset OTP.',
        data: null,
    });
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, otp, newPassword } = req.body;

    const user = await UserModel.findOne({ email }).select('+password');
    if (!user) return next(new AppError('User not found.', 404));
    if (user.otp !== otp) return next(new AppError('Invalid OTP.', 400));
    if (!user.otpExpires || user.otpExpires < new Date())
        return next(new AppError('OTP has expired. Please request a new one.', 400));

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please log in.',
        data: null,
    });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserModel.findById(req.user?._id).select('-password -otp -otpExpires -refresh_token');
    res.status(200).json({
        success: true,
        message: 'Profile fetched successfully.',
        data: user,
    });
});

// ─── PATCH /api/auth/update-profile ───────────────────────────────────────────
export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, phone, address } = req.body;

    // Disallow password changes via this route
    if (req.body.password) {
        return next(new AppError('This route is not for password updates. Use /reset-password.', 400));
    }

    const updated = await UserModel.findByIdAndUpdate(
        req.user?._id,
        { name, phone, address },
        { new: true, runValidators: true },
    ).select('-password -otp -otpExpires -refresh_token');

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: updated,
    });
});

// ─── PATCH /api/auth/update-avatar ────────────────────────────────────────────
export const updateAvatar = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) return next(new AppError('Please upload an image file.', 400));

    const user = await UserModel.findById(req.user?._id);
    if (!user) return next(new AppError('User not found.', 404));

    // Delete old avatar from Cloudinary if it exists
    if (user.avatar?.public_id) {
        await deleteImage(user.avatar.public_id);
    }

    const uploadResult = await uploadImage(req.file.buffer, 'restaurant/avatars');
    user.avatar = uploadResult;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: 'Avatar updated successfully.',
        data: { avatar: uploadResult.url },
    });
});

// ─── POST /api/auth/google ─────────────────────────────────────────────────────
export const googleAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { idToken } = req.body;

    if (!idToken) {
        return next(new AppError('Please provide a Google ID token.', 400));
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        console.error('[GoogleAuth] Token verification failed:', error instanceof Error ? error.message : error);
        return next(new AppError('Invalid or expired Google token. Please try again.', 401));
    }

    const { name, email, picture } = decodedToken;

    if (!email) {
        return next(new AppError('Google account does not have an associated email.', 400));
    }

    let user = await UserModel.findOne({ email });

    if (!user) {
        // Create new user if they don't exist
        user = await UserModel.create({
            name: name || email.split('@')[0],
            email,
            password: `google_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            avatar: { url: picture || '', public_id: '' },
            signUpWithGoogle: true,
            verify_email: true,
            role: 'user',
            status: 'Active',
        });
    } else {
        // Update user if they exist
        if (!user.signUpWithGoogle) {
            user.signUpWithGoogle = true;
            await user.save({ validateBeforeSave: false });
        }
        
        // Optionally update avatar if it's missing or from Google
        if (picture && (!user.avatar || !user.avatar.url)) {
            user.avatar = { url: picture, public_id: '' };
            await user.save({ validateBeforeSave: false });
        }
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    await UserModel.findByIdAndUpdate(user._id, {
        last_login_date: new Date(),
        refresh_token: refreshToken,
    });

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(200).json({
        success: true,
        message: 'Logged in with Google successfully.',
        data: {
            user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
            accessToken,
        },
    });
});

// ─── POST /api/auth/refresh-token ─────────────────────────────────────────────
export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return next(new AppError('No refresh token provided.', 401));

    let decoded;
    try {
        decoded = verifyToken(token);
    } catch (error) {
        console.error('[RefreshToken] Token verification failed:', error instanceof Error ? error.message : error);
        return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }

    const user = await UserModel.findById(decoded.id).select('-password -otp -otpExpires');
    if (!user) return next(new AppError('User not found.', 404));
    
    // Verify the refresh token matches what's stored in database (prevents token replay attacks)
    if (user.refresh_token !== token) {
        return next(new AppError('Invalid refresh token. Please log in again.', 401));
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id.toString());

    // Set the new token in httpOnly cookie
    res.cookie('accessToken', newAccessToken, cookieOptions);
    
    res.status(200).json({
        success: true,
        message: 'Token refreshed successfully.',
        data: { 
            accessToken: newAccessToken,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                onDuty: user.onDuty,
            }
        },
    });
});

// ─── PATCH /api/auth/toggle-duty ──────────────────────────────────────────────
export const toggleDuty = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = await UserModel.findById(req.user?._id);
    if (!user) return next(new AppError('User not found.', 404));

    const allowedRoles = ['kitchen', 'chef'];
    if (!allowedRoles.includes(user.role)) {
        return next(new AppError('Only kitchen/chef staff can toggle duty status.', 403));
    }

    user.onDuty = !user.onDuty;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: `You are now ${user.onDuty ? 'On Duty 🟢' : 'Off Duty 🔴'}.`,
        data: { onDuty: user.onDuty },
    });
});
