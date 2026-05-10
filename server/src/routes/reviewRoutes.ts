import { Router } from 'express';
import { z } from 'zod';
import {
    createReview, getMenuItemReviews,
    updateReview, deleteReview, getAllReviews
} from '../controllers/reviewController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';

import validate, { ValidationSource } from '../middleware/validate';
import { createReviewSchema, updateReviewSchema, idParamSchema } from '../schemas/additionalSchemas';

// Validation schema for menuId parameter
const menuIdParamSchema = z.object({
    menuId: z
        .string()
        .length(24, 'Invalid ID: Must be exactly 24 characters.')
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid menu item ID'),
});

const router = Router();

// Public: read reviews for a specific menu item
router.get('/menu-item/:menuId', validate(menuIdParamSchema, ValidationSource.PARAMS), getMenuItemReviews);

// Admin: get all reviews for moderation
router.get('/', protect, restrictTo('admin'), getAllReviews);

// Protected: create / update / delete
router.post('/', protect, validate(createReviewSchema), createReview);
router.patch('/:id', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), validate(updateReviewSchema), updateReview);
router.delete('/:id', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), deleteReview);

export default router;
