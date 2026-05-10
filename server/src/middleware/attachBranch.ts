import { Request, Response, NextFunction } from 'express';
import { resolveBranchId } from '../utils/resolveBranchId';
import AppError from '../utils/AppError';

/**
 * attachBranch
 * 
 * Middleware that resolves the branch context for the current request
 * and attaches it to req.branchId.
 * 
 * This ensures that subsequent controllers and services have a primary 
 * source of truth for the branch ID, even if the frontend did not provide it.
 */
export const attachBranch = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const branchId = resolveBranchId(req);

        // If no branch context can be established at all (unlikely with env defaults)
        if (!branchId) {
            return next(new AppError('Branch context could not be resolved. Please provide a branch ID.', 400));
        }

        // Attach to request object
        req.branchId = branchId;

        next();
    } catch (error) {
        next(new AppError('Failed to resolve branch context.', 500));
    }
};

export default attachBranch;
