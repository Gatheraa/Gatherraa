# Query Limits

All search, filtering, and full-text endpoints enforce the following limits to protect database resources from expensive or malicious queries.

## Query String Length

| Parameter | Default limit | Env var override |
|-----------|--------------|-----------------|
| `q` / `query` | 256 characters | `QUERY_MAX_LENGTH` |

Requests exceeding this limit receive:

```json
{
  "error": "QUERY_TOO_LONG",
  "message": "Query string exceeds maximum length of 256 characters",
  "limit": 256,
  "received": 300
}
```

**Status: 400 Bad Request**

---

## Filter Complexity

Filters are passed as a JSON object via the `filter` query parameter or request body field.

| Constraint | Default limit | Env var override |
|-----------|--------------|-----------------|
| Max total OR clauses (across entire filter tree) | 10 | `FILTER_MAX_OR_CLAUSES` |
| Max AND nesting depth | 3 | `FILTER_MAX_AND_NESTING` |

Requests exceeding these limits receive:

```json
{
  "error": "FILTER_TOO_COMPLEX",
  "message": "AND nesting depth (4) exceeds limit of 3",
  "limits": {
    "maxOrClauses": 10,
    "maxAndNesting": 3
  }
}
```

**Status: 400 Bad Request**

### AND nesting depth

Each `and` key encountered while traversing the filter tree increments the nesting counter. A maximum depth of 3 allows:

```json
{
  "and": [
    {
      "and": [
        { "and": [ { "field": "x", "op": "eq", "value": 1 } ] }
      ]
    }
  ]
}
```

Adding one more level of `and` wrapping would be rejected.

### OR clause count

OR clauses are counted globally across the entire filter tree. For example, two sibling `or` nodes each with 6 clauses total 12 and will be rejected.

---

## Filter Format

```json
{
  "and": [
    { "field": "city", "op": "eq", "value": "London" },
    {
      "or": [
        { "field": "category", "op": "eq", "value": "music" },
        { "field": "category", "op": "eq", "value": "sport" }
      ]
    }
  ]
}
```

### Supported operators

| `op` value | Meaning |
|-----------|---------|
| `eq` | Equal |
| `neq` | Not equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `contains` | Substring / full-text contains |
| `startsWith` | Prefix match |
| `in` | Value is in array |

---

## Affected Endpoints

These endpoints all use the `queryLimits` middleware:

- `GET /api/search`
- `GET /api/referrals`
- `GET /api/booking`
- `GET /api/booking/:id`

---

## Configuration

Limits are read from environment variables at startup:

```bash
QUERY_MAX_LENGTH=256
FILTER_MAX_OR_CLAUSES=10
FILTER_MAX_AND_NESTING=3
```

Set these in your `.env` file or deployment environment to adjust limits without a code change.
