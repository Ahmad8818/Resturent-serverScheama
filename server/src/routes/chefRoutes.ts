import { Router } from 'express';
import {
    getAllChefs, getChef,
    createChef, updateChef, deleteChef,
} from '../controllers/chefController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import upload from '../middleware/multer';

import validate, { ValidationSource } from '../middleware/validate';
import { createChefSchema, updateChefSchema, idParamSchema } from '../schemas/additionalSchemas';

const router = Router();

// Public routes
router.get('/', getAllChefs);
router.get('/:id', validate(idParamSchema, ValidationSource.PARAMS), getChef);

// Admin-only routes
router.post('/', protect, restrictTo('admin'), upload.single('image'), validate(createChefSchema), createChef);
router.patch('/:id', protect, restrictTo('admin'), upload.single('image'), validate(idParamSchema, ValidationSource.PARAMS), validate(updateChefSchema), updateChef);
router.delete('/:id', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), deleteChef);

export default router;
