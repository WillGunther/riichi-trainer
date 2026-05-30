import type { Answer, FieldStatus, FuCategory, FuTotals, LimitTier, Problem } from "./types";

export type FuInputMode = "total" | "split";

export type AnswerInputs = {
  han: string;
  fu: string;
  points: string;
  limitTier: LimitTier;
  groupFu: string;
  waitFu: string;
  handFu: string;
  totalFu: string;
  dealer: boolean;
  tsumo: boolean;
  tsumoChildPoints: string;
  tsumoDealerPoints: string;
};

export type EnabledInputs = {
  han: boolean;
  fu: boolean;
  points: boolean;
  limitTier: boolean;
  dealer: boolean;
  tsumo: boolean;
};

export type ValidationResult = {
  correct: boolean;
  statuses: Record<keyof AnswerInputs, FieldStatus>;
  expectedFuTotals: FuTotals;
  splitFuConstituentsApply: boolean;
};

const emptyCategoryTotals: Record<FuCategory, number> = {
  base: 0,
  group: 0,
  wait: 0,
  hand: 0,
  rounding: 0,
};

export function getFuTotals(answer: Answer): FuTotals {
  const categoryTotals = { ...emptyCategoryTotals };

  for (const item of answer.fuBreakdown ?? []) {
    categoryTotals[item.category] += item.fu;
  }

  const preRound = categoryTotals.base + categoryTotals.group + categoryTotals.wait + categoryTotals.hand;
  const rounded = answer.fu ?? preRound + categoryTotals.rounding;

  return {
    ...categoryTotals,
    preRound,
    rounded,
  };
}

export function normalizePoints(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getExpectedTsumoPayments(points: string) {
  const normalized = normalizePoints(points);
  const allMatch = normalized.match(/^(\d+)\s*all$/);

  if (allMatch) {
    return { child: allMatch[1], dealer: allMatch[1] };
  }

  const splitMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);

  if (splitMatch) {
    return { child: splitMatch[1], dealer: splitMatch[2] };
  }

  return null;
}

function numberMatches(input: string, expected: number | undefined) {
  return expected !== undefined && Number(input) === expected;
}

function statusFor(active: boolean, ok: boolean): FieldStatus {
  if (!active) return "idle";
  return ok ? "correct" : "incorrect";
}

export function validateAnswer(
  inputs: AnswerInputs,
  problem: Problem,
  enabled: EnabledInputs,
  fuInputMode: FuInputMode,
): ValidationResult {
  const { answer } = problem;
  const expectedFuTotals = getFuTotals(answer);
  const expectedTsumoPayments = getExpectedTsumoPayments(answer.points);
  const splitFuConstituentsApply = !problem.tags.includes("fixed fu");
  const statuses: Record<keyof AnswerInputs, FieldStatus> = {
    han: "idle",
    fu: "idle",
    points: "idle",
    limitTier: "idle",
    groupFu: "idle",
    waitFu: "idle",
    handFu: "idle",
    totalFu: "idle",
    dealer: "idle",
    tsumo: "idle",
    tsumoChildPoints: "idle",
    tsumoDealerPoints: "idle",
  };

  statuses.han = statusFor(enabled.han, numberMatches(inputs.han, answer.han));
  statuses.dealer = statusFor(enabled.points && enabled.dealer, inputs.dealer === (problem.hand.seatWind === "east"));
  statuses.tsumo = statusFor(enabled.points && enabled.tsumo, inputs.tsumo === (problem.hand.winMethod === "tsumo"));

  if (enabled.points) {
    if (inputs.tsumo && expectedTsumoPayments) {
      statuses.tsumoChildPoints = statusFor(true, normalizePoints(inputs.tsumoChildPoints) === expectedTsumoPayments.child);
      if (!inputs.dealer) {
        statuses.tsumoDealerPoints = statusFor(true, normalizePoints(inputs.tsumoDealerPoints) === expectedTsumoPayments.dealer);
      }
    } else {
      statuses.points = statusFor(true, normalizePoints(inputs.points) === normalizePoints(answer.points));
    }
  }

  statuses.limitTier = statusFor(enabled.points && enabled.limitTier, inputs.limitTier === answer.limitTier);

  if (enabled.fu) {
    if (fuInputMode === "total") {
      statuses.fu = statusFor(true, numberMatches(inputs.fu, answer.fu));
    } else {
      if (splitFuConstituentsApply) {
        statuses.groupFu = statusFor(true, numberMatches(inputs.groupFu, expectedFuTotals.group));
        statuses.waitFu = statusFor(true, numberMatches(inputs.waitFu, expectedFuTotals.wait));
        statuses.handFu = statusFor(true, numberMatches(inputs.handFu, expectedFuTotals.hand));
      }
      statuses.totalFu = statusFor(true, numberMatches(inputs.totalFu, expectedFuTotals.rounded));
    }
  }

  const activeStatuses = Object.values(statuses).filter((status) => status !== "idle");
  const correct = activeStatuses.length > 0 && activeStatuses.every((status) => status === "correct");

  return { correct, statuses, expectedFuTotals, splitFuConstituentsApply };
}

export function getEmptyInputs(): AnswerInputs {
  return {
    han: "",
    fu: "",
    points: "",
    limitTier: "none",
    groupFu: "",
    waitFu: "",
    handFu: "",
    totalFu: "",
    dealer: false,
    tsumo: false,
    tsumoChildPoints: "",
    tsumoDealerPoints: "",
  };
}
