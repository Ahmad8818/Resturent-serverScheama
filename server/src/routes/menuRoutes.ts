import { Router } from 'express';
import {
    getAllMenuItems, getMenuItem, getFeaturedItems, getDealsItems,
    createMenuItem, updateMenuItem, deleteMenuItem,
} from '../controllers/menuController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import upload from '../middleware/multer';

import validate, { ValidationSource } from '../middleware/validate';
import { createMenuItemSchema, updateMenuItemSchema, idParamSchema, paginationQuerySchema } from '../schemas/additionalSchemas';

const router = Router();

// Public routes
router.get('/', validate(paginationQuerySchema, ValidationSource.QUERY), getAllMenuItems);
router.get('/featured', getFeaturedItems);
router.get('/deals', getDealsItems);
router.get('/:id', validate(idParamSchema, ValidationSource.PARAMS), getMenuItem);

// Admin-only routes
router.post('/', protect, restrictTo('admin'), upload.single('image'), validate(createMenuItemSchema), createMenuItem);
router.patch('/:id', protect, restrictTo('admin'), upload.single('image'), validate(idParamSchema, ValidationSource.PARAMS), validate(updateMenuItemSchema), updateMenuItem);
router.delete('/:id', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), deleteMenuItem);

export default router;
