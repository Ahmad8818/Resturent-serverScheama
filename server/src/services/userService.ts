import UserModel from '../models/User';
import AuditLogModel from '../models/AuditLog';
import AppError from '../utils/AppError';
import { UserRepository } from '../repositories/user.repository';
import { enforceBranchScope } from '../utils/security';

const VALID_STATUSES = ['Active', 'Inactive', 'Suspended'] as const;
type UserStatus = (typeof VALID_STATUSES)[number];

export class UserService {

    static async getAllUsers(query: any, user: any) {
        let filter: any = {};
        
        // Handle role from query parameter
        const requestedRoles = query.role ? query.role.split(',').map((r: string) => r.trim()) : [];
        
        // If frontend explicitly asks for 'user' role (Customers page), allow it for admins
        if (requestedRoles.includes('user') && user.role === 'admin') {
            filter.role = 'user';
        } else {
            // Staff Management page: enforce strict role scoping
            if (user.role === 'admin') {
                filter.role = 'manager';
            } else if (user.role === 'manager') {
                filter.role = { $in: ['kitchen', 'waiter', 'delivery'] };
            }
        }

        // Apply Branch Scope (managers see only their branch)
        filter = enforceBranchScope(filter, user);
        
        return UserRepository.findAll(filter);
    }

    static async getUser(id: string) {
        const user = await UserRepository.findById(id);
        if (!user) throw new AppError('User not found.', 404);
        return user;
    }

    static async updateUserStatus(id: string, status: string, requester: any) {
        if (!(VALID_STATUSES as readonly string[]).includes(status)) {
            throw new AppError('Invalid status. Accepted: Active, Inactive, Suspended.', 400);
        }

        const user = await UserRepository.findById(id);
        if (!user) throw new AppError('User not found.', 404);

        // Security: Managers can only update staff in their branch
        if (requester.role !== 'admin' && user.branchId?.toString() !== requester.branchId?.toString()) {
            throw new AppError('Access denied. You can only manage staff in your own branch.', 403);
        }

        const updatedUser = await UserRepository.updateStatus(id, status as UserStatus);
        
        // Audit Logging
        await AuditLogModel.create({
            action: 'UPDATE_STAFF_STATUS',
            performedBy: requester._id,
            branch: requester.branchId || user.branchId,
            resourceType: 'USER',
            resourceId: user._id,
            details: {
                message: `Staff member ${user.name} status changed from ${user.status} to ${status}.`,
                oldValue: { status: user.status },
                newValue: { status: status }
            }
        });

        return updatedUser;
    }

    static async updateUser(id: string, updateData: any, requester: any) {
        const user = await UserRepository.findById(id);
        if (!user) throw new AppError('User not found.', 404);

        // Security: Managers can only update staff in their branch
        if (requester.role !== 'admin' && user.branchId?.toString() !== requester.branchId?.toString()) {
            throw new AppError('Access denied. You can only manage staff in your own branch.', 403);
        }

        // Policy: Manager cannot edit another manager or admin
        if (requester.role === 'manager' && ['admin', 'manager'].includes(user.role)) {
            throw new AppError('Managers cannot edit other managers or admins.', 403);
        }

        // Policy: Prevent privilege escalation (Manager assigning 'manager' role)
        if (updateData.role && requester.role === 'manager' && ['admin', 'manager'].includes(updateData.role)) {
            throw new AppError('Managers cannot assign admin or manager roles.', 403);
        }

        const oldRole = user.role;
        const oldName = user.name;
        
        if (updateData.name) user.name = updateData.name;
        if (updateData.role) user.role = updateData.role;
        if (updateData.status && VALID_STATUSES.includes(updateData.status)) {
             user.status = updateData.status;
        }

        await user.save();

        // Audit Logging
        await AuditLogModel.create({
            action: 'UPDATE_STAFF',
            performedBy: requester._id,
            branch: requester.branchId || user.branchId,
            resourceType: 'USER',
            resourceId: user._id,
            details: {
                message: `Staff member ${user.name} details updated by ${requester.name}.`,
                oldValue: { role: oldRole, name: oldName },
                newValue: { role: user.role, name: user.name, status: user.status }
            }
        });

        return user;
    }

    static async createStaff(data: any, creator: any) {
        const { name, email, password, role, branchId } = data;

        // 1. Role Creation Constraints (HARD Validation)
        const allowedRolesByCreator: Record<string, string[]> = {
            admin: ['manager', 'kitchen', 'waiter', 'delivery'],
            manager: ['kitchen', 'waiter', 'delivery'],
        };

        const allowedRoles = allowedRolesByCreator[creator.role] || [];
        if (!allowedRoles.includes(role)) {
            throw new AppError(`Role '${creator.role}' is not allowed to create '${role}' users.`, 403);
        }

        // 2. Smart Branch Assignment (CRITICAL)
        // Normalize: treat empty string as undefined
        let targetBranch = branchId && branchId.trim() !== '' ? branchId : undefined;
        
        if (creator.role === 'manager') {
            // Managers cannot assign branch manually
            if (targetBranch && targetBranch.toString() !== creator.branchId.toString()) {
                throw new AppError('Managers cannot assign branch manually to other branches.', 400);
            }
            targetBranch = creator.branchId;
        } else if (creator.role === 'admin' && !targetBranch) {
             throw new AppError('Staff must be assigned to a branch by Admin.', 400);
        }

        // 3. Create user
        const user = await UserRepository.create({
            name,
            email,
            password,
            role,
            branchId: targetBranch,
            verify_email: true, // Internal staff created by admins are pre-verified
            status: 'Active'
        });

        // 4. Audit Logging (BIG UPGRADE)
        await AuditLogModel.create({
            action: 'CREATE_STAFF',
            performedBy: creator._id,
            branch: creator.branchId || targetBranch, // Admin might not have a branchId
            resourceType: 'USER',
            resourceId: user._id,
            details: {
                message: `Staff member ${user.name} (${user.role}) created by ${creator.name}.`,
                newValue: { role: user.role, branchId: user.branchId }
            }
        });

        return user;
    }

    static async deleteUser(id: string, requester: any) {
        const userToDelete = await UserRepository.findById(id);
        if (!userToDelete) throw new AppError('User not found.', 404);

        // Security: Managers can only delete staff in their branch
        if (requester.role !== 'admin' && userToDelete.branchId?.toString() !== requester.branchId?.toString()) {
            throw new AppError('Access denied. You can only manage staff in your own branch.', 403);
        }

        // Policy: Manager cannot delete another manager or admin
        if (requester.role === 'manager' && ['admin', 'manager'].includes(userToDelete.role)) {
             throw new AppError('Managers cannot delete other managers or admins.', 403);
        }

        // In this system, we "Suspend" or "Deactivate" instead of hard delete to preserve history
        // Or we can do a hard delete if the repository supports it.
        // Let's assume we want to track the deletion.
        
        const deletedUser = await UserModel.findByIdAndDelete(id);
        if (!deletedUser) throw new AppError('Failed to delete user.', 500);

        // Audit Logging
        await AuditLogModel.create({
            action: 'DELETE_STAFF',
            performedBy: requester._id,
            branch: requester.branchId || userToDelete.branchId,
            resourceType: 'USER',
            resourceId: userToDelete._id,
            details: {
                message: `Staff member ${userToDelete.name} (${userToDelete.role}) deleted by ${requester.name}.`,
                oldValue: { name: userToDelete.name, role: userToDelete.role, email: userToDelete.email }
            }
        });

        return deletedUser;
    }

    static async searchUsers(query: string, user: any) {
        const filter = enforceBranchScope({}, user);
        return UserRepository.search(query, filter);
    }
}
