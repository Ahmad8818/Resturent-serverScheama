import { Router } from 'express';
import {
    getAllUsers,
    getUser,
    updateUserStatus,
    searchUsers,
    createStaff,
    deleteUser,
    updateUser
} from '../controllers/userController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import validate, { ValidationSource } from '../middleware/validate';
import { idParamSchema } from '../schemas/additionalSchemas';

const router = Router();

// User management routes
router.use(protect);

router.get('/', restrictTo('admin', 'manager'), getAllUsers);
router.get('/search', restrictTo('admin'), searchUsers);
router.get('/:id', restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), getUser);
router.patch('/:id/status', restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), updateUserStatus);

// Admin & Manager can create staff (Manager locked to Branch in service)
router.post('/staff', restrictTo('admin', 'manager'), createStaff);

// Modify and delete users (Constraints inside Service Layer)
router.delete('/:id', restrictTo('admin', 'manager'), validate(idParamSchema, ValidationSource.PARAMS), deleteUser);
router.patch('/:id/update', restrictTo('admin', 'manager'), validate(idParamSchema, ValidationSource.PARAMS), updateUser);

export default router;
