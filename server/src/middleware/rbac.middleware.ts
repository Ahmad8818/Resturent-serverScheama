import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';
import { OrderStatus } from '../domain/order/order.state-machine';

/**
 * enforceBranchScope - Ensures that the query is restricted to the user's branch.
 * For non-admins, it forces the 'restaurant' field to match the user's assigned branch.
 */
export const enforceBranchScope = (req: Request, query: any = {}) => {
    if (!req.user) return query;
    
    // Admins and managers can see everything (managers are branch-scoped via req.branchId already)
    if (req.user.role === 'admin' || req.user.role === 'manager') {
        return query;
    }

    // Staff must be assigned to a branch
    if (!req.user.branchId) {
        throw new AppError('User is not assigned to any branch', 403);
    }

    return {
        ...query,
        branchId: req.user.branchId
    };
};

/**
 * ROLE_TRANSITION_MATRIX - Defines which roles can move an order into which status.
 * This is an overlay on top of the domain state machine.
 */
const ROLE_TRANSITION_MATRIX: Record<string, OrderStatus[] | 'ALL'> = {
    kitchen: ['PREPARING', 'READY'],
    waiter: ['SERVED', 'PICKED_UP', 'COMPLETED'],
    delivery: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'],
    manager: 'ALL',
    admin: 'ALL'
};

/**
 * canRoleTransition - Logic-only check for role permissions on status.
 */
export const canRoleTransition = (role: string, nextStatus: OrderStatus): boolean => {
    const allowed = ROLE_TRANSITION_MATRIX[role];
    if (!allowed) return false;
    if (allowed === 'ALL') return true;
    return allowed.includes(nextStatus);
};

/**
 * restrictToTransition - Middleware to guard status update endpoints.
 */
export const restrictToTransition = (req: Request, res: Response, next: NextFunction) => {
    const { newStatus } = req.body;
    const role = req.user?.role;

    if (!role || !newStatus) {
        return next(new AppError('Missing role or target status', 400));
    }

    if (!canRoleTransition(role, newStatus as OrderStatus)) {
        return next(new AppError(`Role '${role}' is not permitted to move orders into '${newStatus}'`, 403));
    }

    next();
};

/**
 * checkAssignment - Midleware for Delivery role.
 * Ensures the order is actually assigned to 'me'.
 */
export const checkOrderOwnership = (req: Request, order: any) => {
    if (req.user?.role === 'delivery') {
         if (order.assignedTo?.toString() !== req.user._id.toString()) {
             throw new AppError('This delivery is not assigned to you', 403);
         }
    }
    
    if (req.user?.role === 'waiter') {
        if (order.createdBy?.toString() !== req.user._id.toString()) {
            throw new AppError('You do not have access to this order session', 403);
        }
    }
};
