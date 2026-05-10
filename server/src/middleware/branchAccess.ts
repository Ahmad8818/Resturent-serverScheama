import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

export const requireBranch = (req: Request, res: Response, next: NextFunction) => {
    // Admins usually supply branchId via query or body to perform actions across branches
    if (req.user?.role === 'admin') {
        req.branchId = (req.query.branchId as string) || (req.body.branchId as string);
        return next();
    }

    // Regular Staff must only operate inside their assigned branch
    if (!req.user?.branchId) {
        return next(new AppError('Unauthorized: User not assigned to any branch', 403));
    }

    req.branchId = req.user.branchId.toString();
    next();
};
