export const SCHEMA: string;
export class PromptError extends Error {}
export type AiTask = "sql" | "answer" | "vendor";
export interface BuiltPrompt {
  system: string;
  user: string;
  json: boolean;
  quick: boolean;
}
export function buildPrompt(task: AiTask, input: Record<string, unknown>): BuiltPrompt;
