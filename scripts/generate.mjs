#!/usr/bin/env node
// Simple scaffolder: npm run generate <slice> [--kind=api|page|sql|agent|all]
// Examples:
//   npm run generate request-status -- --kind=api
//   npm run generate coverage -- --kind=all

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npm run generate <slice> [--kind=api|page|sql|agent|all]");
  process.exit(1);
}
const slice = args[0];
const kindArg = (args.find((a) => a.startsWith("--kind=")) || "--kind=all").split("=")[1];

const TPL = (rel) => resolve(__dirname, "../templates", rel);
const OUT = (rel) => resolve(__dirname, "..", rel);

const readTpl = (p) => readFileSync(p, "utf8");
const mustWrite = (path, content) => {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf8");
  console.log("Created:", path.replace(process.cwd() + "/", ""));
};

const render = (s, vars) =>
  s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`));

const vars = {
  slice,
  Slice: slice
    .split(/[-_]/g)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(""),
};

const want = new Set(
  kindArg === "all" ? ["api", "page", "sql", "agent"] : [kindArg]
);

// API
if (want.has("api")) {
  const tpl = readTpl(TPL("api-route.tsx.tpl"));
  mustWrite(
    OUT(`app/api/${slice}/route.ts`),
    render(tpl, vars)
  );
}

// Page
if (want.has("page")) {
  const tpl = readTpl(TPL("page.tsx.tpl"));
  mustWrite(
    OUT(`app/${slice}/page.tsx`),
    render(tpl, vars)
  );
}

// SQL
if (want.has("sql")) {
  const tpl = readTpl(TPL("migration.sql.tpl"));
  mustWrite(OUT(`supabase/migrations/${Date.now()}_${slice}.sql`), render(tpl, vars));
}

// Agent
if (want.has("agent")) {
  const tpl = readTpl(TPL("agent.ts.tpl"));
  mustWrite(OUT(`agents/${slice}.ts`), render(tpl, vars));
}
