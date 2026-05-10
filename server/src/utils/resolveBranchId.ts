import { Request } from 'express';
import { isValidObjectId } from './mongoose';

/**
 * resolveBranchId
 * 
 * Centralized utility to determine which branch context a request belongs to.
 * Priority:
 * 1. Request Body (manual selection/override)
 * 2. Request Query (manual selection/override)
 * 3. X-Branch-Id header (frontend app context)
 * 4. Logged-in staff member's restaurant (user context)
 * 5. Environment default (system context)
 * 
 * @param req Express Request object
 * @returns Resolved branch ID as a string or undefined
 */
export const resolveBranchId = (req: Request): string | undefined => {
    let rawId: string | undefined;
    let source: string = 'none';

    if (req.body?.restaurantId && isValidObjectId(req.body.restaurantId)) {
        rawId = req.body.restaurantId;
        source = 'Body (restaurantId)';
    } else if (req.body?.branchId && isValidObjectId(req.body.branchId)) {
        rawId = req.body.branchId;
        source = 'Body (branchId)';
    } else if (req.query?.branchId && isValidObjectId(req.query.branchId as string)) {
        rawId = req.query.branchId as string;
        source = 'Query (branchId)';
    } else if (req.headers['x-branch-id'] && isValidObjectId(req.headers['x-branch-id'] as string)) {
        rawId = req.headers['x-branch-id'] as string;
        source = 'Header (X-Branch-Id)';
    } else if (req.user?.branchId && isValidObjectId(req.user.branchId.toString())) {
        rawId = req.user.branchId.toString();
        source = 'User Profile';
    } else if (process.env.DEFAULT_BRANCH_ID && isValidObjectId(process.env.DEFAULT_BRANCH_ID)) {
        rawId = process.env.DEFAULT_BRANCH_ID;
        source = 'System Default (BRANCH_ID)';
    } else if (process.env.DEFAULT_RESTAURANT_ID && isValidObjectId(process.env.DEFAULT_RESTAURANT_ID)) {
        rawId = process.env.DEFAULT_RESTAURANT_ID;
        source = 'System Default (RESTAURANT_ID)';
    }

    if (rawId) {
        console.debug(`[Tenancy] Resolved branchId: ${rawId} via ${source}`);
    } else {
        console.warn(`[Tenancy] Failed to resolve branchId for path: ${req.path}`);
    }

    return rawId;
};
