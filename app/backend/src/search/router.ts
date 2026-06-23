import { Router } from 'express';
import { queryLimits } from '../middleware/queryLimits';
import { searchEvents } from './controller';

const router = Router();

router.get('/', queryLimits(), searchEvents);

export default router;
