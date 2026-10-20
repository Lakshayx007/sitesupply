export interface RequestContext {
  origin?: string;
  host?: string;
  ip?: string;
}
export const RATE: { max: number; windowMs: number };
export function model(): string;
export function rateLimit(ip: string | undefined, now?: number): number;
export function resetRateLimit(): void;
export function originAllowed(origin: string | undefined, host: string | undefined): boolean;
export function requestContext(headers: Record<string, string | string[] | undefined>): RequestContext;
export function handleAi(
  method: string | undefined,
  body: unknown,
  apiKey: string | undefined,
  ctx?: RequestContext,
): Promise<[number, unknown, Record<string, string>?]>;
