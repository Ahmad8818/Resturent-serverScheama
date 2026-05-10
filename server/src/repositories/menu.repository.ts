import { ClientSession, Types } from 'mongoose';
import MenuItemModel from '../models/MenuItem';
import RestaurantModel from '../models/Restaurant';
import type { IMenuItem } from '../models/MenuItem';

export type { IMenuItem };

// ─── MenuRepository ───────────────────────────────────────────────────────────

export class MenuRepository {

    /**
     * Fetch all available items that belong to a given set of IDs AND a branch.
     * Used during order creation to lock prices within the transaction.
     */
    static async findAvailableByIdsAndBranch(
        ids:      string[],
        branchId: string,
        session?: ClientSession,
    ): Promise<IMenuItem[]> {
        const q = MenuItemModel.find({
            _id:         { $in: ids },
            branchId:    new Types.ObjectId(branchId),
            isAvailable: true,
        });
        if (session) q.session(session);
        return q.exec();
    }

    /** Find a single item by ID. */
    static async findById(id: string, session?: ClientSession): Promise<IMenuItem | null> {
        const q = MenuItemModel.findById(id).populate('category', 'name image');
        if (session) q.session(session);
        return q.exec();
    }

    /**
     * Fetch items by IDs with no availability or branch filter.
     * Used only to build human-readable error messages.
     */
    static async findByIds(ids: string[]): Promise<IMenuItem[]> {
        return MenuItemModel.find({ _id: { $in: ids } }).lean<IMenuItem[]>();
    }

    /** All available items with optional ApiFeatures query. */
    static async findAllAvailable(filter: Record<string, unknown> = {}): Promise<IMenuItem[]> {
        return MenuItemModel
            .find({ isAvailable: true, ...filter })
            .populate('category', 'name image')
            .lean<IMenuItem[]>();
    }

    /** Featured available items. */
    static async findFeatured(): Promise<IMenuItem[]> {
        return MenuItemModel
            .find({ isAvailable: true, featured: true })
            .populate('category', 'name')
            .sort({ averageRating: -1 })
            .limit(10)
            .lean<IMenuItem[]>();
    }

    /** Deal items. */
    static async findDeals(): Promise<IMenuItem[]> {
        return MenuItemModel
            .find({ isAvailable: true, isDeal: true })
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean<IMenuItem[]>();
    }

    /** Find the restaurant that belongs to this admin ID. */
    static async findRestaurantByOwner(adminId: string) {
        return RestaurantModel.findOne({ owner: adminId });
    }

    /** Create a new menu item. */
    static async create(data: Record<string, unknown>): Promise<IMenuItem> {
        return MenuItemModel.create(data);
    }

    /**
     * Atomic deduction: finds the item only if it belongs to the branch,
     * is available, and has sufficient stock. Returns updated doc or null.
     */
    static async atomicDeductStock(
        menuItemId: string,
        branchId:   string,
        quantity:   number,
        session?:   ClientSession,
    ): Promise<IMenuItem | null> {
        const filter = {
            _id:         new Types.ObjectId(menuItemId),
            branchId:    new Types.ObjectId(branchId),
            isAvailable: true,
            stock:       { $gte: quantity },
        };
        const update = { $inc: { stock: -quantity } };
        const opts   = { new: true, session: session ?? undefined };
        return MenuItemModel.findOneAndUpdate(filter, update, opts);
    }

    /**
     * Atomic restore: adds stock back and re-enables the item if stock > 0.
     * Uses an aggregation-pipeline update for a single round-trip.
     */
    static async atomicRestoreStock(
        menuItemId: string,
        branchId:   string,
        quantity:   number,
        session?:   ClientSession,
    ): Promise<void> {
        const filter = {
            _id:        new Types.ObjectId(menuItemId),
            branchId:   new Types.ObjectId(branchId),
        };
        // Aggregation pipeline update: restore stock and re-enable item in one write
        const pipeline = [
            { $set: { stock: { $add: ['$stock', quantity] } } },
            { $set: { isAvailable: { $gt: ['$stock', 0] } } },
        ];
        const opts = { session: session ?? undefined };
        // Cast through any to satisfy TS — the runtime shape is valid for MongoDB
        await MenuItemModel.updateOne(filter, pipeline as any, opts);
    }

    /** Plain findByIdAndUpdate for admin menu management. */
    static async updateById(
        id:   string,
        data: Record<string, unknown>,
    ): Promise<IMenuItem | null> {
        return MenuItemModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }

    /** Hard-delete a menu item. */
    static async deleteById(id: string): Promise<void> {
        await MenuItemModel.findByIdAndDelete(id);
    }

    /** Count of all available items. */
    static async countAvailable(): Promise<number> {
        return MenuItemModel.countDocuments({ isAvailable: true });
    }
}
