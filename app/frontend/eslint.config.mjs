import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/*.test.{ts,tsx,js,jsx}",
    "**/*.spec.{ts,tsx,js,jsx}",
    "**/*.stories.{ts,tsx,js,jsx}",
  ]),
  {
    rules: {
      // No console.* in production code — use the structured logger instead.
      // Exceptions are handled via eslint-disable-next-line in logger.ts and story files.
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Allow console.* and any in test files, stories, demo, example, and scripts
  {
    files: [
      "**/*.stories.{ts,tsx,js,jsx}",
      "**/*.test.{ts,tsx,js,jsx}",
      "**/*.spec.{ts,tsx,js,jsx}",
      "**/scripts/**",
      "**/seed*.{ts,js}",
      "**/demo/**",
      "**/*Example*.{ts,tsx,js,jsx}",
      "**/*Demo*.{ts,tsx,js,jsx}",
      // Moved orphaned components (in-flight migration to proper directories):
      "components/events/EventCountdownTimer.tsx",
      "components/events/EventStatusBadge.tsx",
      "components/wallet/WalletActivityFeed.tsx",
      "components/TransactionStatus/TransactionRetryHandler.tsx",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
