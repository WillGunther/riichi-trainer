import problemsJson from "./problems.json";
import type { Problem } from "./types";

export const problems = problemsJson as unknown as Problem[] satisfies Problem[];
export const problemCount = problems.length;
