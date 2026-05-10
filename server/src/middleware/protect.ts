import { Request, Response, NextFunction } from 'express';
import UserModel from '../models/User';
import AppError from '../utils/AppError';
import { verifyToken } from '../utils/generateToken';
import { resolveBranchId } from '../utils/resolveBranchId';

/**
 * protect – JWT authentication middleware.
 * Reads token from cookie or Authorization header.
 * Attaches `req.user` for downstream controllers.
 */
const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // 1. Get token
        let token: string | undefined;

        if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        } else if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer ')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('You are not logged in. Please log in to get access.', 401));
        }

        // 2. Verify token
        const decoded = verifyToken(token);

        // 3. Check if user still exists
        const currentUser = await UserModel.findById(decoded.id).select('+password');
        if (!currentUser) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }

        // 4. Check if user account is active
        if (currentUser.status !== 'Active') {
            return next(new AppError('Your account has been suspended. Contact support.', 401));
        }

        // 5. Attach user to request
        req.user = currentUser;

        // 6. Refresh branch context (priority might shift to user's restaurant)
        req.branchId = resolveBranchId(req);

        next();
    } catch (error: unknown) {
        const err = error as Error;
        if (err.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token. Please log in again.', 401));
        }
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Your token has expired. Please log in again.', 401));
        }
        next(error);
    }
};

export default protect;
