// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,

  // Strict rules for all TS files (without type checking — avoids Drizzle resolution issues)
  ...tseslint.configs.recommended,

  {
    rules: {
      // No any — hard rule
      "@typescript-eslint/no-explicit-any": "error",

      // No unused vars
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],

      // Explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // No non-null assertions
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Prefer const
      "prefer-const": "error",

      // No console (use proper logging)
      "no-console": "warn",
    },
  },

  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.js",
      "**/*.mjs",
      "**/next-env.d.ts",
      "task-12.txt",
      "task-13.txt",
    ],
  },
);
