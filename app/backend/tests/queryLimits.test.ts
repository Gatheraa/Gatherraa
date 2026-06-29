import request from 'supertest';
import app from '../src/app';

const ENDPOINTS = ['/api/search', '/api/referrals', '/api/booking'];

// Builds an AND-nested filter to the requested depth
function makeNestedAnd(depth: number): object {
  if (depth <= 0) return { field: 'x', op: 'eq', value: 1 };
  return { and: [makeNestedAnd(depth - 1)] };
}

describe('[security] Query size and complexity limits', () => {
  describe('Query string length', () => {
    it('accepts a query exactly at the limit (256 chars)', async () => {
      const q = 'a'.repeat(256);
      const res = await request(app).get('/api/search').query({ q });
      expect(res.status).toBe(200);
    });

    it('rejects a query one character over the limit', async () => {
      const q = 'a'.repeat(257);
      const res = await request(app).get('/api/search').query({ q });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('QUERY_TOO_LONG');
      expect(res.body.limit).toBe(256);
      expect(res.body.received).toBe(257);
    });

    it('rejects a long query on all protected endpoints', async () => {
      const q = 'x'.repeat(300);
      for (const endpoint of ENDPOINTS) {
        const res = await request(app).get(endpoint).query({ q });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('QUERY_TOO_LONG');
      }
    });
  });

  describe('Filter complexity — AND nesting', () => {
    it('accepts a filter nested exactly at the limit (depth 3)', async () => {
      const filter = JSON.stringify(makeNestedAnd(3));
      const res = await request(app).get('/api/search').query({ filter });
      expect(res.status).toBe(200);
    });

    it('rejects a deeply nested AND filter (depth 4) — returns 400 Bad Request', async () => {
      const filter = JSON.stringify(makeNestedAnd(4));
      const res = await request(app).get('/api/search').query({ filter });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('FILTER_TOO_COMPLEX');
      expect(res.body.message).toMatch(/AND nesting depth/);
    });

    it('rejects deeply nested filter on /api/referrals', async () => {
      const filter = JSON.stringify(makeNestedAnd(4));
      const res = await request(app).get('/api/referrals').query({ filter });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('FILTER_TOO_COMPLEX');
    });

    it('rejects deeply nested filter on /api/booking', async () => {
      const filter = JSON.stringify(makeNestedAnd(4));
      const res = await request(app).get('/api/booking').query({ filter });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('FILTER_TOO_COMPLEX');
    });
  });

  describe('Filter complexity — OR clauses', () => {
    it('accepts a filter with exactly 10 OR clauses', async () => {
      const filter = JSON.stringify({
        or: Array.from({ length: 10 }, (_, i) => ({
          field: 'category', op: 'eq', value: `cat${i}`,
        })),
      });
      const res = await request(app).get('/api/search').query({ filter });
      expect(res.status).toBe(200);
    });

    it('rejects a filter with 11 OR clauses', async () => {
      const filter = JSON.stringify({
        or: Array.from({ length: 11 }, (_, i) => ({
          field: 'category', op: 'eq', value: `cat${i}`,
        })),
      });
      const res = await request(app).get('/api/search').query({ filter });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('FILTER_TOO_COMPLEX');
      expect(res.body.message).toMatch(/OR clauses/);
    });

    it('accumulates OR clauses across nested nodes', async () => {
      // 6 + 6 = 12 total OR clauses across two sibling or-nodes
      const filter = JSON.stringify({
        and: [
          { or: Array.from({ length: 6 }, (_, i) => ({ field: 'a', op: 'eq', value: i })) },
          { or: Array.from({ length: 6 }, (_, i) => ({ field: 'b', op: 'eq', value: i })) },
        ],
      });
      const res = await request(app).get('/api/search').query({ filter });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('FILTER_TOO_COMPLEX');
    });
  });

  describe('Filter validation', () => {
    it('rejects a malformed (non-JSON) filter', async () => {
      const res = await request(app).get('/api/search').query({ filter: '{bad json' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_FILTER');
    });

    it('accepts a valid structured filter within all limits', async () => {
      const filter = JSON.stringify({
        and: [
          { field: 'city', op: 'eq', value: 'London' },
          {
            or: [
              { field: 'category', op: 'eq', value: 'music' },
              { field: 'category', op: 'eq', value: 'sport' },
            ],
          },
        ],
      });
      const res = await request(app).get('/api/search').query({ filter });
      expect(res.status).toBe(200);
    });
  });
});
