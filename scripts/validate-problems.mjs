import { readFile } from "node:fs/promises";

const file = await readFile(new URL("../src/problems.json", import.meta.url), "utf8");
const allowedLimitTiers = new Set(["none", "mangan", "haneman", "baiman", "sanbaiman", "yakuman"]);
const allowedFuCategories = new Set(["base", "group", "wait", "hand", "rounding"]);
const allowedMeldTypes = new Set(["chi", "pon", "kan"]);
const allowedTilePattern = /^(?:[1-9][mps]|5[mps]r|[ESWNPFC])$/;
const allowedWinMethods = new Set(["ron", "tsumo"]);
const allowedWinds = new Set(["east", "south", "west", "north"]);
const errors = [];
let problems = [];

try {
  problems = JSON.parse(file);
} catch (error) {
  errors.push(`Problems JSON is invalid: ${error.message}`);
}

if (!Array.isArray(problems)) {
  errors.push("Problems JSON must be an array.");
  problems = [];
}

const ids = problems.map((problem) => problem?.id).filter(Boolean);

if (ids.length === 0) {
  errors.push("No problems found.");
}

if (ids.length !== new Set(ids).size) {
  errors.push("Problem ids must be unique.");
}

function validateTiles(label, tiles) {
  if (!Array.isArray(tiles)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  for (const tile of tiles) {
    if (typeof tile !== "string" || !allowedTilePattern.test(tile)) {
      errors.push(`${label} contains invalid tile code: ${JSON.stringify(tile)}`);
    }
  }
}

for (const [index, problem] of problems.entries()) {
  const label = problem?.id ?? `problem[${index}]`;

  if (!problem || typeof problem !== "object") {
    errors.push(`${label} must be an object.`);
    continue;
  }

  if (typeof problem.id !== "string" || problem.id.length === 0) {
    errors.push(`${label}.id must be a non-empty string.`);
  }

  if (typeof problem.title !== "string" || problem.title.length === 0) {
    errors.push(`${label}.title must be a non-empty string.`);
  }

  if (!Array.isArray(problem.tags) || !problem.tags.every((tag) => typeof tag === "string")) {
    errors.push(`${label}.tags must be a string array.`);
  }

  if (!problem.hand || typeof problem.hand !== "object") {
    errors.push(`${label}.hand must be an object.`);
  } else {
    validateTiles(`${label}.hand.concealedTiles`, problem.hand.concealedTiles);
    validateTiles(`${label}.hand.doraIndicators`, problem.hand.doraIndicators);

    if (problem.hand.uraDoraIndicators !== undefined) {
      validateTiles(`${label}.hand.uraDoraIndicators`, problem.hand.uraDoraIndicators);
    }

    if (typeof problem.hand.winningTile !== "string" || !allowedTilePattern.test(problem.hand.winningTile)) {
      errors.push(`${label}.hand.winningTile is invalid.`);
    }

    if (!allowedWinds.has(problem.hand.seatWind)) {
      errors.push(`${label}.hand.seatWind is invalid.`);
    }

    if (!allowedWinds.has(problem.hand.roundWind)) {
      errors.push(`${label}.hand.roundWind is invalid.`);
    }

    if (!allowedWinMethods.has(problem.hand.winMethod)) {
      errors.push(`${label}.hand.winMethod is invalid.`);
    }

    if (typeof problem.hand.riichi !== "boolean") {
      errors.push(`${label}.hand.riichi must be boolean.`);
    }

    if (!Array.isArray(problem.hand.melds)) {
      errors.push(`${label}.hand.melds must be an array.`);
    } else {
      for (const [meldIndex, meld] of problem.hand.melds.entries()) {
        const meldLabel = `${label}.hand.melds[${meldIndex}]`;
        if (!allowedMeldTypes.has(meld?.type)) {
          errors.push(`${meldLabel}.type is invalid.`);
        }
        if (typeof meld?.open !== "boolean") {
          errors.push(`${meldLabel}.open must be boolean.`);
        }
        validateTiles(`${meldLabel}.tiles`, meld?.tiles);
        if (meld?.calledTile !== undefined && !allowedTilePattern.test(meld.calledTile)) {
          errors.push(`${meldLabel}.calledTile is invalid.`);
        }
      }
    }
  }

  if (!problem.answer || typeof problem.answer !== "object") {
    errors.push(`${label}.answer must be an object.`);
  } else {
    if (!Number.isInteger(problem.answer.han) || problem.answer.han < 1) {
      errors.push(`${label}.answer.han must be a positive integer.`);
    }

    if (problem.answer.fu !== undefined && (!Number.isInteger(problem.answer.fu) || problem.answer.fu < 20)) {
      errors.push(`${label}.answer.fu must be an integer of at least 20.`);
    }

    if (typeof problem.answer.points !== "string" || problem.answer.points.length === 0) {
      errors.push(`${label}.answer.points must be a non-empty string.`);
    }

    if (!allowedLimitTiers.has(problem.answer.limitTier)) {
      errors.push(`${label}.answer.limitTier is invalid.`);
    }

    if (!Array.isArray(problem.answer.yaku) || problem.answer.yaku.length === 0) {
      errors.push(`${label}.answer.yaku must be a non-empty array.`);
    } else {
      for (const yaku of problem.answer.yaku) {
        if (typeof yaku?.name !== "string" || !Number.isInteger(yaku?.han)) {
          errors.push(`${label}.answer.yaku entries must have name and integer han.`);
        }
      }
    }

    if (problem.answer.fuBreakdown !== undefined) {
      if (!Array.isArray(problem.answer.fuBreakdown)) {
        errors.push(`${label}.answer.fuBreakdown must be an array.`);
      } else {
        for (const item of problem.answer.fuBreakdown) {
          if (typeof item?.name !== "string" || !Number.isInteger(item?.fu) || !allowedFuCategories.has(item?.category)) {
            errors.push(`${label}.answer.fuBreakdown entries must have name, integer fu, and category.`);
          }
        }
      }
    }
  }
}

const allFuCategories = new Set(problems.flatMap((problem) => problem.answer?.fuBreakdown?.map((item) => item.category) ?? []));
const allLimitTiers = new Set(problems.map((problem) => problem.answer?.limitTier));
const allWinMethods = new Set(problems.map((problem) => problem.hand?.winMethod));
const hasOpenHand = problems.some((problem) => problem.hand?.melds?.length > 0);
const hasClosedHand = problems.some((problem) => problem.hand?.melds?.length === 0);

for (const required of ["group", "wait", "hand"]) {
  if (!allFuCategories.has(required)) {
    errors.push(`Missing representative sample for fu category: ${required}.`);
  }
}

for (const required of ["mangan", "haneman"]) {
  if (!allLimitTiers.has(required)) {
    errors.push(`Missing representative sample for limit tier: ${required}.`);
  }
}

for (const required of ["ron", "tsumo"]) {
  if (!allWinMethods.has(required)) {
    errors.push(`Missing representative sample for win method: ${required}.`);
  }
}

if (!hasOpenHand) {
  errors.push("Missing representative sample for open hand.");
}

if (!hasClosedHand) {
  errors.push("Missing representative sample for closed hand.");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${ids.length} generated problems.`);
