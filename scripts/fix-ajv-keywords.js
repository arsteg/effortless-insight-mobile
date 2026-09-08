#!/usr/bin/env node
/**
 * ajv-keywords@5 declares `ajv: ^8.8.2`, but npm dedupes it onto the ajv@6 that
 * eslint hoists to the top of the tree. ajv@6 has no `dist/compile/codegen`, so
 * requiring ajv-keywords throws:
 *
 *   Error: Cannot find module 'ajv/dist/compile/codegen'
 *
 * That chain is schema-utils -> expo-quick-actions/app.plugin.js, which Expo
 * loads while evaluating config plugins. So `expo prebuild` dies before Gradle
 * starts, and every EAS build fails.
 *
 * npm `overrides` cannot express "ajv@8 for ajv-keywords, ajv@6 for eslint" --
 * whichever wins gets hoisted and the other breaks. So install the correct ajv
 * locally under ajv-keywords instead. Idempotent; safe to re-run.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "node_modules");
const keywords = path.join(root, "ajv-keywords");
const target = path.join(keywords, "node_modules", "ajv");

function version(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
  } catch {
    return null;
  }
}

if (!fs.existsSync(keywords)) process.exit(0);
if ((version(target) || "").startsWith("8")) process.exit(0);

// Prefer an ajv@8 that npm already placed somewhere in the tree.
const candidates = [
  path.join(root, "ajv"),
  path.join(root, "schema-utils", "node_modules", "ajv"),
  path.join(root, "ajv-formats", "node_modules", "ajv"),
];
const source = candidates.find((dir) => (version(dir) || "").startsWith("8"));

if (!source) {
  console.warn("[fix-ajv-keywords] no ajv@8 found in the tree; skipping");
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log(`[fix-ajv-keywords] linked ajv@${version(target)} for ajv-keywords`);
