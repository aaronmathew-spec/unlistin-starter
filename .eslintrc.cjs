/* eslint-env node */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  rules: {
    // Prefer type-only imports, but don't fail the build if missed
    "@typescript-eslint/consistent-type-imports": "warn",

    // Allow intentionally unused underscore-prefixed args/vars (e.g., `_req`)
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
    ],

    // Keep "any" as a warning so we can progressively add types
    "@typescript-eslint/no-explicit-any": "warn",

    // Reasonable console policy
    "no-console": ["warn", { allow: ["warn", "error"] }]
  }
};
