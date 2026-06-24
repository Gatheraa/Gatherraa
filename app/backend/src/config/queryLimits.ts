export interface QueryLimitConfig {
  maxQueryLength: number;
  maxOrClauses: number;
  maxAndNesting: number;
}

export const DEFAULT_QUERY_LIMITS: QueryLimitConfig = {
  maxQueryLength: parseInt(process.env.QUERY_MAX_LENGTH ?? '256', 10),
  maxOrClauses: parseInt(process.env.FILTER_MAX_OR_CLAUSES ?? '10', 10),
  maxAndNesting: parseInt(process.env.FILTER_MAX_AND_NESTING ?? '3', 10),
};
