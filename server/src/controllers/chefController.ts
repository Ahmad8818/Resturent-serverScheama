import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import ChefModel from '../models/Chef';
import { uploadImage, deleteImage } from '../services/cloudinaryService';

// Removed local uploadToCloudinary helper

// ─── GET /api/chefs ────────────────────────────────────────────────────────────
export const getAllChefs = asyncHandler(async (_req: Request, res: Response) => {
    const chefs = await ChefModel.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        message: 'Chefs fetched successfully.',
        data: {
            chefs,
            results: chefs.length,
        },
    });
});

// ─── GET /api/chefs/:id ────────────────────────────────────────────────────────
export const getChef = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const chef = await ChefModel.findOne({ _id: req.params.id, isActive: true });
    if (!chef) return next(new AppError('Chef not found.', 404));
    res.status(200).json({
        success: true,
        message: 'Chef fetched successfully.',
        data: chef,
    });
});

// ─── POST /api/chefs (admin) ──────────────────────────────────────────────────
export const createChef = asyncHandler(async (req: Request, res: Response) => {
    if (req.file) {
        req.body.image = await uploadImage(req.file.buffer, 'restaurant/chefs');
    }

    // Parse embedded JSON fields if sent as form-data strings
    if (typeof req.body.signatureDishes === 'string') {
        try { req.body.signatureDishes = JSON.parse(req.body.signatureDishes); } catch { req.body.signatureDishes = []; }
    }
    if (typeof req.body.awards === 'string') {
        try { req.body.awards = JSON.parse(req.body.awards); } catch { req.body.awards = []; }
    }
    if (typeof req.body.socialLinks === 'string') {
        try { req.body.socialLinks = JSON.parse(req.body.socialLinks); } catch { req.body.socialLinks = {}; }
    }

    const chef = await ChefModel.create(req.body);
    res.status(201).json({
        success: true,
        message: 'Chef created successfully.',
        data: chef,
    });
});

// ─── PATCH /api/chefs/:id (admin) ─────────────────────────────────────────────
export const updateChef = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const chef = await ChefModel.findById(req.params.id);
    if (!chef) return next(new AppError('Chef not found.', 404));

    if (req.file) {
        if (chef.image?.public_id) {
            await deleteImage(chef.image.public_id);
        }
        req.body.image = await uploadImage(req.file.buffer, 'restaurant/chefs');
    }

    if (typeof req.body.signatureDishes === 'string') {
        try { req.body.signatureDishes = JSON.parse(req.body.signatureDishes); } catch { /* keep original */ }
    }

    const updated = await ChefModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    res.status(200).json({
        success: true,
        message: 'Chef updated successfully.',
        data: updated,
    });
});

// ─── DELETE /api/chefs/:id (admin – permanent delete) ─────────────────────────
export const deleteChef = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const chef = await ChefModel.findById(req.params.id);
    if (!chef) return next(new AppError('Chef not found.', 404));

    try {
        // 1. Delete image from Cloudinary if it exists
        if (chef.image?.public_id) {
            await deleteImage(chef.image.public_id);
        }

        // 2. Permanently delete from database
        await ChefModel.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Chef and associated image deleted permanently from both systems.',
            data: null,
        });
    } catch (error) {
        console.error('Delete Error:', error);
        return next(new AppError('Failed to delete chef and associated media.', 500));
    }
});
