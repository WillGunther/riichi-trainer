import problemsJson from "./problems.json";
import type { ScoringProblem } from "./types";

export const problems = problemsJson as ScoringProblem[];
export const problemCount = problems.length;
