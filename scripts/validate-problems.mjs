import { readFile } from "node:fs/promises";

const file = await readFile(new URL("../src/problems.ts", import.meta.url), "utf8");
const ids = [...file.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
const titles = [...file.matchAll(/title: "([^"]+)"/g)].map((match) => match[1]);
const limitTiers = [...file.matchAll(/limitTier: "([^"]+)"/g)].map((match) => match[1]);

const allowedLimitTiers = new Set(["none", "mangan", "haneman", "baiman", "sanbaiman", "yakuman"]);
const errors = [];

if (ids.length === 0) {
  errors.push("No problems found.");
}

if (ids.length !== new Set(ids).size) {
  errors.push("Problem ids must be unique.");
}

if (ids.length !== titles.length) {
  errors.push("Every problem must have a title.");
}

for (const tier of limitTiers) {
  if (!allowedLimitTiers.has(tier)) {
    errors.push(`Unknown limit tier: ${tier}`);
  }
}

for (const required of ["category: \"group\"", "category: \"wait\"", "category: \"hand\"", "limitTier: \"mangan\"", "limitTier: \"haneman\""]) {
  if (!file.includes(required)) {
    errors.push(`Missing representative sample for ${required}.`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${ids.length} curated problems.`);
