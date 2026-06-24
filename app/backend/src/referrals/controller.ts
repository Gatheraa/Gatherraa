import { Request, Response } from 'express';

export async function listReferrals(req: Request, res: Response): Promise<void> {
  const { q, filter, page = '1', limit = '20' } = req.query;
  // TODO: execute parameterised query against PostgreSQL referrals table
  res.json({
    results: [],
    meta: { q, filter, page: Number(page), limit: Number(limit) },
  });
}
