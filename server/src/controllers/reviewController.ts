import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import ReviewModel from '../models/Review';
import MenuItemModel from '../models/MenuItem';
import UserModel from '../models/User';

// ─── POST /api/reviews ────────────────────────────────────────────────────────
export const createReview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { review, rating, menuItemId } = req.body;

    if (!menuItemId) return next(new AppError('menuItemId is required.', 400));

    const item = await MenuItemModel.findById(menuItemId);
    if (!item) return next(new AppError('Menu item not found.', 404));

    // Check if user already reviewed this item (DB unique index will also catch this)
    const existing = await ReviewModel.findOne({ user: req.user?._id, menuItem: menuItemId });
    if (existing) return next(new AppError('You have already reviewed this item.', 400));

    const newReview = await ReviewModel.create({
        review,
        rating,
        user: req.user?._id,
        menuItem: menuItemId,
    });

    // Populate user info after creation with try-catch
    let populatedReview = newReview;
    try {
        populatedReview = await newReview.populate({
            path: 'user',
            select: 'name avatar email',
        });
    } catch (error) {
        console.warn('Warning: Could not populate user info for review');
        // Continue without population rather than failing
    }

    res.status(201).json({
        success: true,
        message: 'Review created successfully.',
        data: populatedReview,
    });
});

// ─── GET /api/reviews/menu/:menuId ────────────────────────────────────────────
export const getMenuItemReviews = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const menuItem = await MenuItemModel.findById(req.params.menuId);
    if (!menuItem) return next(new AppError('Menu item not found.', 404));

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let reviews;
    const total = await ReviewModel.countDocuments({ menuItem: req.params.menuId });

    try {
        reviews = await ReviewModel.find({ menuItem: req.params.menuId })
            .populate({
                path: 'user',
                select: 'name avatar email',
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    } catch (error) {
        console.warn('Warning: Could not populate user info for reviews, returning without population');
        reviews = await ReviewModel.find({ menuItem: req.params.menuId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    res.status(200).json({
        success: true,
        message: 'Reviews fetched successfully.',
        data: {
            reviews,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            results: reviews.length,
        },
    });
});

// ─── PATCH /api/reviews/:id ───────────────────────────────────────────────────
export const updateReview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const review = await ReviewModel.findById(req.params.id);
    if (!review) return next(new AppError('Review not found.', 404));

    // Only the review owner can update
    if (review.user.toString() !== req.user?._id.toString()) {
        return next(new AppError('You can only update your own reviews.', 403));
    }

    const updated = await ReviewModel.findByIdAndUpdate(
        req.params.id,
        { review: req.body.review, rating: req.body.rating },
        { new: true, runValidators: true },
    );

    // Populate user info after update with try-catch
    let populatedReview = updated;
    if (updated) {
        try {
            populatedReview = await updated.populate({
                path: 'user',
                select: 'name avatar email',
            });
        } catch (error) {
            console.warn('Warning: Could not populate user info for review');
            // Continue without population rather than failing
        }
    }

    res.status(200).json({
        success: true,
        message: 'Review updated successfully.',
        data: populatedReview,
    });
});

// ─── DELETE /api/reviews/:id ──────────────────────────────────────────────────
export const deleteReview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const review = await ReviewModel.findById(req.params.id);
    if (!review) return next(new AppError('Review not found.', 404));

    // Owner or admin can delete
    if (
        review.user.toString() !== req.user?._id.toString() &&
        req.user?.role !== 'admin'
    ) {
        return next(new AppError('You do not have permission to delete this review.', 403));
    }

    await ReviewModel.findByIdAndDelete(req.params.id);
    // Post-delete hook on the Review schema will recalculate averageRating

    res.status(200).json({
        success: true,
        message: 'Review deleted successfully.',
        data: null,
    });
});

// ─── GET /api/reviews (admin) ────────────────────────────────────────────────
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await ReviewModel.countDocuments();

    let reviews;
    try {
        reviews = await ReviewModel.find()
            .populate('user', 'name avatar email')
            .populate('menuItem', 'name image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    } catch (error) {
        console.warn('Warning: Could not populate user and menu item info, returning without population');
        reviews = await ReviewModel.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    res.status(200).json({
        success: true,
        message: 'All reviews fetched successfully.',
        data: {
            reviews,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            results: reviews.length,
        },
    });
});
