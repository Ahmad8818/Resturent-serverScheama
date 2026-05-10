import { Router } from 'express';
import {
    getAllCategories, getCategory,
    createCategory, updateCategory, deleteCategory,
} from '../controllers/categoryController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import upload from '../middleware/multer';

import validate, { ValidationSource } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema, idParamSchema } from '../schemas/additionalSchemas';

const router = Router();

router.get('/', getAllCategories);
router.get('/:id', validate(idParamSchema, ValidationSource.PARAMS), getCategory);

router.post('/', protect, restrictTo('admin'), upload.single('image'), validate(createCategorySchema), createCategory);
router.patch('/:id', protect, restrictTo('admin'), upload.single('image'), validate(idParamSchema, ValidationSource.PARAMS), validate(updateCategorySchema), updateCategory);
router.delete('/:id', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), deleteCategory);

export default router;
