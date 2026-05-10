import { Types } from 'mongoose';
import UserModel from '../models/User';
import OrderModel, { IOrder } from '../models/Order';
import AppError from '../utils/AppError';
import { OrderRepository } from '../repositories/order.repository';

export class ChefService {
    /**
     * Assigns a chef to an order.
     * If no chefId is provided, it auto-assigns the chef with the least active orders who is below capacity.
     */
    static async assignChef(orderId: string, managerId: string, chefId?: string): Promise<IOrder> {
        const order = await OrderModel.findById(orderId);
        if (!order) throw new AppError('Order not found', 404);

        let finalChefId: Types.ObjectId;

        if (chefId) {
            const chef = await UserModel.findOne({ 
                _id: chefId, 
                role: { $in: ['chef', 'kitchen'] }, 
                status: 'Active' 
            });
            if (!chef) throw new AppError('Chef not found', 404);
            if (!chef.onDuty) throw new AppError('Chef is currently off duty', 400);
            if (!chef.isAvailable || chef.activeOrdersCount >= chef.maxCapacity) {
                throw new AppError('Chef is currently at maximum capacity', 400);
            }
            finalChefId = chef._id;
        } else {
            // Auto-assign: onDuty + has remaining capacity
            const availableChefs = await UserModel.find({ 
                role: { $in: ['chef', 'kitchen'] }, 
                status: 'Active',
                onDuty: true,
                isAvailable: true,
            }).sort({ activeOrdersCount: 1 });

            const chefs = availableChefs.filter(
                c => c.activeOrdersCount < c.maxCapacity
            );

            if (chefs.length === 0) throw new AppError('No available chefs on duty with capacity', 400);

            finalChefId = chefs[0]._id;
        }

        // Handle reassignment logic: if already assigned and accepted, decrement old chef
        if (order.chefAssignment?.chefId && order.chefAssignment.acceptedAt) {
            await this.decrementChefCount(order.chefAssignment.chefId.toString());
        }

        order.chefAssignment = {
            chefId: finalChefId,
            assignedAt: new Date(),
        };
        order.assignedTo = finalChefId; // Backward compatibility

        order.statusHistory.push({
            status: order.orderStatus,
            time: new Date(),
        });

        await order.save();
        return order;
    }

    /**
     * Increments the active orders count for a chef and updates availability.
     */
    static async incrementChefCount(chefId: string) {
        const chef = await UserModel.findById(chefId);
        if (!chef) return;

        chef.activeOrdersCount = (chef.activeOrdersCount || 0) + 1;
        chef.isAvailable = chef.activeOrdersCount < chef.maxCapacity;
        await chef.save();
    }

    /**
     * Decrements the active orders count for a chef and updates availability.
     */
    static async decrementChefCount(chefId: string) {
        const chef = await UserModel.findById(chefId);
        if (!chef) return;

        chef.activeOrdersCount = Math.max(0, (chef.activeOrdersCount || 0) - 1);
        chef.isAvailable = chef.activeOrdersCount < chef.maxCapacity;
        await chef.save();
    }

    /**
     * Chef accepts the assigned order.
     */
    static async acceptOrder(orderId: string, chefId: string): Promise<IOrder> {
        const order = await OrderModel.findOne({ _id: orderId, 'chefAssignment.chefId': chefId });
        if (!order) throw new AppError('Order not assigned to this chef', 404);
        if (order.orderStatus !== 'CONFIRMED') throw new AppError('Order must be in CONFIRMED status to accept', 400);

        order.chefAssignment!.acceptedAt = new Date();

        order.statusHistory.push({
            status: order.orderStatus,
            time: new Date(),
        });

        await this.incrementChefCount(chefId);
        await order.save();
        return order;
    }

    /**
     * Chef starts preparing the order.
     */
    static async startPreparing(orderId: string, chefId: string): Promise<IOrder> {
        const order = await OrderModel.findOne({ _id: orderId, 'chefAssignment.chefId': chefId });
        if (!order) throw new AppError('Order not assigned to this chef', 404);
        if (!order.chefAssignment?.acceptedAt) throw new AppError('Order must be accepted before preparing', 400);

        order.orderStatus = 'PREPARING';
        order.chefAssignment!.startedPreparingAt = new Date();

        order.statusHistory.push({
            status: 'PREPARING',
            time: new Date(),
            updatedBy: new Types.ObjectId(chefId)
        });

        await order.save();
        return order;
    }

    /**
     * Chef marks the order as ready.
     */
    static async markReady(orderId: string, chefId: string): Promise<IOrder> {
        const order = await OrderModel.findOne({ _id: orderId, 'chefAssignment.chefId': chefId });
        if (!order) throw new AppError('Order not assigned to this chef', 404);
        if (order.orderStatus !== 'PREPARING') throw new AppError('Order must be in PREPARING status to mark as READY', 400);

        order.orderStatus = 'READY';
        order.chefAssignment!.readyAt = new Date();

        order.statusHistory.push({
            status: 'READY',
            time: new Date(),
            updatedBy: new Types.ObjectId(chefId)
        });

        await order.save();
        return order;
    }

    /**
     * Chef rejects the order.
     */
    static async rejectOrder(orderId: string, chefId: string): Promise<IOrder> {
        const order = await OrderModel.findOne({ _id: orderId, 'chefAssignment.chefId': chefId });
        if (!order) throw new AppError('Order not assigned to this chef', 404);

        order.chefAssignment!.rejected = true;
        order.assignedTo = undefined;

        order.statusHistory.push({
            status: 'REJECTED_BY_CHEF',
            time: new Date(),
            updatedBy: new Types.ObjectId(chefId)
        });

        await order.save();
        return order;
    }

    /**
     * Calculates dynamic metrics for an order.
     */
    static getOrderMetrics(order: IOrder) {
        const metrics = {
            acceptanceDelay: 0,
            preparationTime: 0,
            totalTime: 0
        };

        if (order.chefAssignment?.assignedAt && order.chefAssignment?.acceptedAt) {
            metrics.acceptanceDelay = Math.round((order.chefAssignment.acceptedAt.getTime() - order.chefAssignment.assignedAt.getTime()) / 60000);
        }

        if (order.chefAssignment?.startedPreparingAt && order.chefAssignment?.readyAt) {
            metrics.preparationTime = Math.round((order.chefAssignment.readyAt.getTime() - order.chefAssignment.startedPreparingAt.getTime()) / 60000);
        }

        if (order.createdAt && order.chefAssignment?.readyAt) {
            metrics.totalTime = Math.round((order.chefAssignment.readyAt.getTime() - order.createdAt.getTime()) / 60000);
        }

        return metrics;
    }
}
