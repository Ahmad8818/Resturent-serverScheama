import BranchModel from '../models/Branch';
import AppError from '../utils/AppError';

export class BranchService {
    static async getAllBranches() {
        return await BranchModel.find({ isActive: true }).sort({ name: 1 });
    }

    static async getBranchById(id: string) {
        const branch = await BranchModel.findById(id);
        if (!branch) throw new AppError('Branch not found.', 404);
        return branch;
    }

    static async createBranch(body: any) {
        // Check if branch already exists
        if (body.name) {
            const existingBranch = await BranchModel.findOne({ name: body.name });
            if (existingBranch) {
                throw new AppError(`Branch "${body.name}" already exists.`, 400);
            }
        }

        const branch = await BranchModel.create({
            name: body.name,
            description: body.description,
            location: body.location,
            contact: body.contact,
            totalCapacity: body.totalCapacity,
            maxBookingDuration: body.maxBookingDuration || 120,
            minBookingDuration: body.minBookingDuration || 60,
            bufferTime: body.bufferTime || 15,
            operatingHours: body.operatingHours,
        });

        return branch;
    }

    static async updateBranch(id: string, body: any) {
        const branch = await BranchModel.findByIdAndUpdate(id, body, {
            new: true,
            runValidators: true,
        });
        if (!branch) throw new AppError('Branch not found.', 404);
        return branch;
    }

    static async deleteBranch(id: string) {
        const branch = await BranchModel.findByIdAndDelete(id);
        if (!branch) throw new AppError('Branch not found.', 404);
        return null;
    }

    static async getBranchTables(id: string) {
        // Lazy loading to avoid circular dependencies issues between domain initializations
        const TableModel = require('../models/Table').default;

        const branch = await BranchModel.findById(id);
        if (!branch) throw new AppError('Branch not found.', 404);

        const tables = await TableModel.find({ branchId: id, isActive: true }).sort({ tableNumber: 1 });
        return tables;
    }
}
