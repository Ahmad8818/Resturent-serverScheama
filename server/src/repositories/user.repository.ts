import { ClientSession } from 'mongoose';
import UserModel from '../models/User';
import type { IUser } from '../models/User';

export type { IUser };

// ─── UserRepository ───────────────────────────────────────────────────────────

export class UserRepository {

    static async create(data: any): Promise<IUser> {
        return UserModel.create(data);
    }

    static async findAll(filter: any = {}): Promise<IUser[]> {
        return UserModel.find(filter).sort({ createdAt: -1 }).lean<IUser[]>();
    }

    static async findById(id: string): Promise<IUser | null> {
        return UserModel.findById(id);
    }

    static async findByIdWithPassword(id: string): Promise<IUser | null> {
        return UserModel.findById(id).select('+password');
    }

    static async search(query: string, filter: any = {}): Promise<IUser[]> {
        if (!query) return [];
        return UserModel.find({
            ...filter,
            $or: [
                { name:  { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ],
        }).limit(20);
    }

    static async updateStatus(
        id:     string,
        status: string,
    ): Promise<IUser | null> {
        return UserModel.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true },
        );
    }

    /** Push an order ID onto the user's order_history array inside an optional session. */
    static async pushOrderHistory(
        userId:  string,
        orderId: unknown,
        session?: ClientSession,
    ): Promise<void> {
        await UserModel.findByIdAndUpdate(
            userId,
            { $push: { order_history: orderId } },
            { session: session ?? undefined },
        );
    }
}
