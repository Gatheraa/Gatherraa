import { Router } from 'express';
import { queryLimits } from '../middleware/queryLimits';
import { listBookings, getBooking } from './controller';

const router = Router();

router.get('/', queryLimits(), listBookings);
router.get('/:id', queryLimits(), getBooking);

export default router;
