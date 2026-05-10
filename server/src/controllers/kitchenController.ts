import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { ChefService } from '../services/kitchenService';
import { ApiResponse } from '../utils/ApiResponse';
import AppError from '../utils/AppError';

export const assignChef = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { chefId } = req.body;
    const managerId = req.user?._id.toString();

    if (!managerId) throw new AppError('Manager not authenticated', 401);

    const order = await ChefService.assignChef(orderId as string, managerId, chefId);
    res.status(200).json(new ApiResponse('Chef assigned successfully', order));
});

export const acceptOrder = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const chefId = req.user?._id.toString();

    if (!chefId) throw new AppError('Chef not authenticated', 401);

    const order = await ChefService.acceptOrder(orderId as string, chefId);
    res.status(200).json(new ApiResponse('Order accepted successfully', order));
});

export const startPreparing = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const chefId = req.user?._id.toString();

    if (!chefId) throw new AppError('Chef not authenticated', 401);

    const order = await ChefService.startPreparing(orderId as string, chefId);
    res.status(200).json(new ApiResponse('Preparation started', order));
});

export const markReady = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const chefId = req.user?._id.toString();

    if (!chefId) throw new AppError('Chef not authenticated', 401);

    const order = await ChefService.markReady(orderId as string, chefId);
    res.status(200).json(new ApiResponse('Order marked as ready', order));
});

export const rejectOrder = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const chefId = req.user?._id.toString();

    if (!chefId) throw new AppError('Chef not authenticated', 401);

    const order = await ChefService.rejectOrder(orderId as string, chefId);
    res.status(200).json(new ApiResponse('Order rejected by chef', order));
});
