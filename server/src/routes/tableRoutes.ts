import { Router } from 'express';
import {
    getAllTables,
    createTable,
    updateTable,
    deleteTable,
    getTablesWithStatus,
    seedTables
} from '../controllers/tableController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';
import validate, { ValidationSource } from '../middleware/validate';
import { idParamSchema } from '../schemas/additionalSchemas';

const router = Router();

// Public / Guest
router.get('/status', getTablesWithStatus);
router.get('/', getAllTables);

// Admin only
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', createTable);
router.post('/seed', seedTables);
router.patch('/:id', validate(idParamSchema, ValidationSource.PARAMS), updateTable);
router.delete('/:id', validate(idParamSchema, ValidationSource.PARAMS), deleteTable);

export default router;
