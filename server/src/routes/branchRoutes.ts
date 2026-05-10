import { Router } from 'express';
import {
    getAllBranches,
    getBranchById,
    createBranch,
    updateBranch,
    deleteBranch,
    getBranchTables,
} from '../controllers/branchController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import validate, { ValidationSource } from '../middleware/validate';
import { idParamSchema } from '../schemas/additionalSchemas';

const router = Router();

// Public: anyone can view branches
router.get('/', getAllBranches);
router.get('/:id', validate(idParamSchema, ValidationSource.PARAMS), getBranchById);
router.get('/:id/tables', validate(idParamSchema, ValidationSource.PARAMS), getBranchTables);

// Admin only
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', createBranch);
router.patch('/:id', validate(idParamSchema, ValidationSource.PARAMS), updateBranch);
router.delete('/:id', validate(idParamSchema, ValidationSource.PARAMS), deleteBranch);

export default router;
