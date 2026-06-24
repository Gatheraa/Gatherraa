import { Router } from 'express';
import { queryLimits } from '../middleware/queryLimits';
import { listReferrals } from './controller';

const router = Router();

router.get('/', queryLimits(), listReferrals);

export default router;
