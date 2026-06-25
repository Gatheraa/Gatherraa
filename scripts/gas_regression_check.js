#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    reportsDir: path.resolve("contract", "gas_reports"),
    baselinesDir: path.resolve("contract", "gas_baselines"),
    logFile: "",
    mode: "verify",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--reports-dir") {
      args.reportsDir = path.resolve(argv[++i]);
    } else if (value === "--baselines-dir") {
      args.baselinesDir = path.resolve(argv[++i]);
    } else if (value === "--log-file") {
      args.logFile = path.resolve(argv[++i]);
    } else if (value === "--mode") {
      args.mode = argv[++i];
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/gas_regression_check.js [--log-file FILE] [--reports-dir DIR] [--baselines-dir DIR] [--mode verify|record]");
      process.exit(0);
    }
  }

  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readMeasurements({ logFile, reportsDir }) {
  const measurements = new Map();

  const sources = [];
  if (logFile && fs.existsSync(logFile)) {
    sources.push(logFile);
  }

  const fallback = path.join(reportsDir, "gas_benchmark.log");
  if (sources.length === 0 && fs.existsSync(fallback)) {
    sources.push(fallback);
  }

  for (const source of sources) {
    const contents = fs.readFileSync(source, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      if (!line.startsWith("GAS_METRIC|")) {
        continue;
      }

      const parts = line.split("|");
      if (parts.length < 4) {
        continue;
      }

      const operation = parts[1];
      const gasUsed = Number(parts[2]);
      const timestamp = Number(parts[3]);
      if (!Number.isFinite(gasUsed)) {
        continue;
      }

      measurements.set(operation, {
        operation,
        gas_used: gasUsed,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
      });
    }
  }

  return measurements;
}

function loadBaselines(baselinesDir) {
  const baselines = [];
  for (const entry of fs.readdirSync(baselinesDir)) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const baseline = loadJson(path.join(baselinesDir, entry));
    baselines.push({
      file: entry,
      ...baseline,
    });
  }

  baselines.sort((a, b) => a.operation.localeCompare(b.operation));
  return baselines;
}

function toleranceRange(baselineGas, tolerancePercentage) {
  const delta = Math.floor((baselineGas * tolerancePercentage) / 100);
  return {
    min: Math.max(0, baselineGas - delta),
    max: baselineGas + delta,
  };
}

function compareMeasurements(baselines, measurements) {
  const results = [];
  const failures = [];

  for (const baseline of baselines) {
    const measurement = measurements.get(baseline.operation);
    if (!measurement) {
      failures.push(`Missing measurement for ${baseline.operation} (${baseline.file})`);
      continue;
    }

    const tolerance = Number(baseline.tolerance_percentage ?? 10);
    const { min, max } = toleranceRange(Number(baseline.baseline_gas), tolerance);
    const current = Number(measurement.gas_used);
    const inRange = current >= min && current <= max;

    results.push({
      operation: baseline.operation,
      baseline_gas: Number(baseline.baseline_gas),
      current_gas: current,
      tolerance_percentage: tolerance,
      min_allowed: min,
      max_allowed: max,
      status: inRange ? "pass" : "fail",
      baseline_file: baseline.file,
    });

    if (!inRange) {
      failures.push(
        `${baseline.operation} drifted outside ${tolerance}%: current=${current}, expected=${baseline.baseline_gas} (${min}-${max})`
      );
    }
  }

  return { results, failures };
}

function writeArtifacts({ reportsDir, results, measurements, mode }) {
  ensureDir(reportsDir);

  const currentPath = path.join(reportsDir, "gas_measurements.json");
  fs.writeFileSync(
    currentPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        mode,
        measurements: Array.from(measurements.values()).sort((a, b) => a.operation.localeCompare(b.operation)),
      },
      null,
      2
    )
  );

  const summaryPath = path.join(reportsDir, "gas_regression_summary.md");
  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const lines = [
    "# Gas Regression Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${mode}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    "",
    "| Operation | Baseline | Current | Tolerance | Status |",
    "| --- | ---: | ---: | ---: | --- |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.operation} | ${result.baseline_gas} | ${result.current_gas} | ${result.tolerance_percentage}% | ${result.status} |`
    );
  }

  fs.writeFileSync(summaryPath, lines.join("\n"));

  if (mode === "record") {
    const trendsDir = path.join(reportsDir, "trends");
    ensureDir(trendsDir);
    const sha = process.env.GITHUB_SHA || "local";
    const trendPath = path.join(trendsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${sha}.json`);
    fs.copyFileSync(currentPath, trendPath);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureDir(args.reportsDir);

  if (!fs.existsSync(args.baselinesDir)) {
    throw new Error(`Baseline directory not found: ${args.baselinesDir}`);
  }

  const baselines = loadBaselines(args.baselinesDir);
  if (baselines.length === 0) {
    throw new Error(`No gas baselines found in ${args.baselinesDir}`);
  }

  const measurements = readMeasurements(args);
  const { results, failures } = compareMeasurements(baselines, measurements);
  writeArtifacts({ reportsDir: args.reportsDir, results, measurements, mode: args.mode });

  if (failures.length > 0) {
    console.error("Gas regression check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Gas regression check passed for ${results.length} tracked operations.`);
}

main();
