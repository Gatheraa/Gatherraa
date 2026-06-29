import { Request, Response } from 'express';

export async function listBookings(req: Request, res: Response): Promise<void> {
  const { q, filter, page = '1', limit = '20' } = req.query;
  // TODO: execute parameterised query against PostgreSQL bookings table
  res.json({
    results: [],
    meta: { q, filter, page: Number(page), limit: Number(limit) },
  });
}

export async function getBooking(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  // TODO: query single booking by id
  res.json({ id, data: null });
}
