import { Types } from 'mongoose';
import AppError from './AppError';

/**
 * Enforces branch scoping on a mongoose query object based on the user's role and branchId.
 * @param query The existing query object
 * @param user The user object (from req.user)
 * @returns The scoped query object
 */
export function enforceBranchScope(query: any, user: any) {
    if (!user) return query;

    // Admins see everything
    if (user.role === 'admin') return query;

    // Others must be restricted to their branch
    if (!user.branchId) {
        throw new AppError('User is not assigned to a branch.', 403);
    }

    return { ...query, branchId: user.branchId };
}

/**
 * Checks if a user has access to a specific resource based on branch ownership.
 * @param user The user object
 * @param resource The resource object (must have branchId)
 * @throws AppError if access is denied
 */
export function checkBranchAccess(user: any, resource: any) {
    if (!user) throw new AppError('Authentication required', 401);
    
    // Admins have access to everything
    if (user.role === 'admin') return;

    if (!resource.branchId) return; // If resource is not branch-specific, allow access (or define policy)

    if (user.branchId && resource.branchId.toString() !== user.branchId.toString()) {
        throw new AppError('Access denied. You do not have permission to access resources in this branch.', 403);
    }
}
