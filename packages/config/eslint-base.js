// Shared ESLint flat config. Each app/package extends this and adds its own
// framework-specific rules (React Native, NestJS, etc.) on top.
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["dist/**", "build/**", ".turbo/**", ".expo/**", "node_modules/**"],
  },
];
