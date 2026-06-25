# Gas Baselines

Each JSON file in this directory defines a single tracked gas baseline.

Format:

```json
{
  "operation": "ticket_initialize",
  "baseline_gas": 45000,
  "tolerance_percentage": 10,
  "contract_version": 1
}
```

CI compares the latest gas benchmark report against these files and fails the
build if any tracked operation drifts outside the configured tolerance.
