import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import CategoryModel from '../models/Category';
import { uploadImage, deleteImage } from '../services/cloudinaryService';

// Removed local uploadToCloudinary helper

// ─── GET /api/categories ───────────────────────────────────────────────────────
export const getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
    const categories = await CategoryModel.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({
        success: true,
        message: 'Categories fetched successfully.',
        data: {
            categories,
            results: categories.length,
        },
    });
});

// ─── GET /api/categories/:id ──────────────────────────────────────────────────
export const getCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const category = await CategoryModel.findById(req.params.id);
    if (!category || !category.isActive) {
        return next(new AppError('Category not found.', 404));
    }
    res.status(200).json({
        success: true,
        message: 'Category fetched successfully.',
        data: category,
    });
});

// ─── POST /api/categories ─────────────────────────────────────────────────────
export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name } = req.body;
    if (!name) return next(new AppError('Category name is required.', 400));

    if (req.file) {
        req.body.image = await uploadImage(req.file.buffer, 'restaurant/categories');
    }

    const category = await CategoryModel.create(req.body);
    res.status(201).json({
        success: true,
        message: 'Category created successfully.',
        data: category,
    });
});

// ─── PATCH /api/categories/:id ────────────────────────────────────────────────
export const updateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const category = await CategoryModel.findById(req.params.id);
    if (!category) return next(new AppError('Category not found.', 404));

    if (req.file) {
        // Delete old image from Cloudinary safely
        if (category.image?.public_id) {
            await deleteImage(category.image.public_id);
        }
        req.body.image = await uploadImage(req.file.buffer, 'restaurant/categories');
    }

    const updated = await CategoryModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    res.status(200).json({
        success: true,
        message: 'Category updated successfully.',
        data: updated,
    });
});

// ─── DELETE /api/categories/:id (hard delete) ────────────────────────────────
export const deleteCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const category = await CategoryModel.findById(req.params.id);
    if (!category) return next(new AppError('Category not found.', 404));

    try {
        // 1. Delete image from Cloudinary if it exists
        if (category.image?.public_id) {
            await deleteImage(category.image.public_id);
        }

        // 2. Permanently delete from database
        await CategoryModel.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Category and associated image deleted permanently.',
            data: null,
        });
    } catch (error) {
        console.error('Delete Error:', error);
        return next(new AppError('Failed to delete category and associated media.', 500));
    }
});
