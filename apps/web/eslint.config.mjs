// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "prefer-const": "error",
      "no-console": "warn",
    },
  },

  // Relax rules for shadcn/ui generated components and utils
  {
    files: ["components/ui/**/*.tsx", "lib/utils.ts"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },

  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "**/*.js",
      "**/*.mjs",
      "next-env.d.ts",
    ],
  },
);
