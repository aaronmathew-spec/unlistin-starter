/* eslint-env node */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }]
  }
};
