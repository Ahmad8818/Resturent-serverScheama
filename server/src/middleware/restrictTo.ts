import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

/**
 * restrictTo – Role-based authorization middleware.
 * Must always be called AFTER protect.
 *
 * Usage: router.patch('/admin-only', protect, restrictTo('admin'), handler)
 */
const restrictTo = (...roles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action.', 403));
        }
        next();
    };
};

export default restrictTo;
