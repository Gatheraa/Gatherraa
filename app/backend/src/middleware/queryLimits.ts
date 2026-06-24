import { Request, Response, NextFunction } from 'express';
import { DEFAULT_QUERY_LIMITS, QueryLimitConfig } from '../config/queryLimits';

interface FilterNode {
  and?: FilterNode[];
  or?: FilterNode[];
  field?: string;
  op?: string;
  value?: unknown;
}

function measureComplexity(
  node: FilterNode,
  andDepth: number,
  orCount: { total: number },
  limits: QueryLimitConfig,
): string | null {
  if (node.and !== undefined) {
    if (!Array.isArray(node.and)) return '"and" must be an array';
    const newDepth = andDepth + 1;
    if (newDepth > limits.maxAndNesting) {
      return `AND nesting depth (${newDepth}) exceeds limit of ${limits.maxAndNesting}`;
    }
    for (const child of node.and) {
      const err = measureComplexity(child, newDepth, orCount, limits);
      if (err) return err;
    }
  }

  if (node.or !== undefined) {
    if (!Array.isArray(node.or)) return '"or" must be an array';
    orCount.total += node.or.length;
    if (orCount.total > limits.maxOrClauses) {
      return `Total OR clauses (${orCount.total}) exceed limit of ${limits.maxOrClauses}`;
    }
    for (const child of node.or) {
      const err = measureComplexity(child, andDepth, orCount, limits);
      if (err) return err;
    }
  }

  return null;
}

export function queryLimits(config: QueryLimitConfig = DEFAULT_QUERY_LIMITS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const q = req.query.q ?? req.query.query;
    if (typeof q === 'string' && q.length > config.maxQueryLength) {
      res.status(400).json({
        error: 'QUERY_TOO_LONG',
        message: `Query string exceeds maximum length of ${config.maxQueryLength} characters`,
        limit: config.maxQueryLength,
        received: q.length,
      });
      return;
    }

    const filterParam = req.query.filter ?? (req.body as Record<string, unknown>)?.filter;
    if (filterParam !== undefined) {
      let filter: FilterNode;
      try {
        filter = typeof filterParam === 'string' ? (JSON.parse(filterParam) as FilterNode) : (filterParam as FilterNode);
      } catch {
        res.status(400).json({
          error: 'INVALID_FILTER',
          message: 'filter parameter is not valid JSON',
        });
        return;
      }

      const orCount = { total: 0 };
      const err = measureComplexity(filter, 0, orCount, config);
      if (err) {
        res.status(400).json({
          error: 'FILTER_TOO_COMPLEX',
          message: err,
          limits: {
            maxOrClauses: config.maxOrClauses,
            maxAndNesting: config.maxAndNesting,
          },
        });
        return;
      }
    }

    next();
  };
}
