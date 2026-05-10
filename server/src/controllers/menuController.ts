import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import { MenuService } from '../services/menuService';
import { ApiResponse } from '../utils/ApiResponse';

// ─── GET /api/menu ─────────────────────────────────────────────────────────────
export const getAllMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const data = await MenuService.getAllMenuItems(req.query as Record<string, string>);
    res.status(200).json(new ApiResponse('Menu items fetched successfully.', data));
});

// ─── GET /api/menu/featured ────────────────────────────────────────────────────
export const getFeaturedItems = asyncHandler(async (_req: Request, res: Response) => {
    const data = await MenuService.getFeaturedItems();
    res.status(200).json(new ApiResponse('Featured items fetched successfully.', data));
});

// ─── GET /api/menu/deals ───────────────────────────────────────────────────────
export const getDealsItems = asyncHandler(async (_req: Request, res: Response) => {
    const data = await MenuService.getDealsItems();
    res.status(200).json(new ApiResponse('Deals items fetched successfully.', data));
});

// ─── GET /api/menu/:id ─────────────────────────────────────────────────────────
export const getMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const data = await MenuService.getMenuItem(req.params.id as string);
    res.status(200).json(new ApiResponse('Menu item fetched successfully.', data));
});

// ─── POST /api/menu ────────────────────────────────────────────────────────────
export const createMenuItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) return next(new AppError('Item image is required.', 400));
    const adminId = req.user?._id.toString() || '';

    const data = await MenuService.createMenuItem(adminId, req.body, req.file.buffer);
    res.status(201).json(new ApiResponse('Menu item created successfully.', data));
});

// ─── PATCH /api/menu/:id ───────────────────────────────────────────────────────
export const updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const data = await MenuService.updateMenuItem(req.params.id as string, req.body, req.file?.buffer);
    res.status(200).json(new ApiResponse('Menu item updated successfully.', data));
});

// ─── DELETE /api/menu/:id (hard delete) ───────────────────────────────────────
export const deleteMenuItem = asyncHandler(async (req: Request, res: Response) => {
    await MenuService.deleteMenuItem(req.params.id as string);
    res.status(200).json(new ApiResponse('Menu item deleted successfully from both DB and Cloudinary.', null));
});
