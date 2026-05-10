import { Request, Response, NextFunction } from 'express';
import UserModel from '../models/User';
import { verifyToken } from '../utils/generateToken';

/**
 * extractUser – Soft authentication middleware.
 * Attempts to identify the user from JWT but does NOT block if token is missing.
 * Useful for routes like 'Create Order' which support both Guests and Logged-in users.
 */
const extractUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
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
            return next(); // Proceed as guest
        }

        // 2. Verify token
        const decoded = verifyToken(token);
        if (!decoded || !decoded.id) {
            return next(); // Invalid token, proceed as guest
        }

        // 3. Find user
        const currentUser = await UserModel.findById(decoded.id);
        if (!currentUser || currentUser.status !== 'Active') {
            return next(); // User missing or inactive, proceed as guest
        }

        // 4. Attach user to request for downstream logic (order association)
        req.user = currentUser;

        next();
    } catch (error) {
        // Any error in extraction (e.g. expired token) results in guest fallback
        next();
    }
};

export default extractUser;
