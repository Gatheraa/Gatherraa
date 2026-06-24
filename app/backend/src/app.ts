import express from 'express';
import searchRouter from './search/router';
import referralsRouter from './referrals/router';
import bookingRouter from './booking/router';

const app = express();
app.use(express.json());

app.use('/api/search', searchRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/booking', bookingRouter);

export default app;
