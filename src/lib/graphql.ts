import { client } from "./client.js";
import { globalFlags } from "./config.js";
import { CliError } from "./errors.js";

const GRAPHQL_PATH = "/api/v1/graphql";

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<T> {
  data?: T;
  errors?: GraphQlError[];
}

interface UserError {
  message?: string;
  path?: string[];
}

interface Connection<T> {
  nodes?: Array<T | null>;
  edges?: Array<{ node?: T | null; cursor?: string } | null>;
  pageInfo?: {
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
    startCursor?: string | null;
    endCursor?: string | null;
  };
}

/** POST { query, variables } to /api/v1/graphql and unwrap data. */
export async function graphql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const raw = (await client.post(GRAPHQL_PATH, {
    query,
    ...(variables && Object.keys(variables).length > 0 ? { variables } : {}),
  })) as GraphQlResponse<T>;

  if (raw?.errors?.length) {
    const msg = raw.errors.map((e) => e.message).join("; ");
    const unauthorized = /auth|signed in|unauthor|token/i.test(msg);
    throw new CliError(unauthorized ? 401 : 1, msg);
  }
  if (!raw?.data) {
    throw new CliError(1, "Empty GraphQL response");
  }
  return raw.data;
}

/** Flatten a Relay connection into nodes. */
export function unwrapConnection<T>(conn?: Connection<T> | null): T[] {
  if (!conn) return [];
  if (Array.isArray(conn.nodes) && conn.nodes.length > 0) {
    return conn.nodes.filter((n): n is T => n != null);
  }
  return (conn.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is T => n != null);
}

/** Raise if a mutation payload returned user errors. */
export function assertPayloadErrors(payload: { errors?: UserError[] | null } | null | undefined): void {
  const errors = payload?.errors?.filter((e) => e?.message);
  if (errors && errors.length > 0) {
    throw new CliError(1, errors.map((e) => e.message).join("; "));
  }
}

/** Turn nested { id, name } objects into a display name for tables. */
export function nestName(value: unknown): unknown {
  if (value && typeof value === "object" && "name" in (value as object)) {
    return (value as { name?: unknown }).name ?? value;
  }
  return value ?? null;
}

/** Pick a subset of keys, resolving nested name objects. */
export function row(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = nestName(obj[key]);
  }
  return out;
}

export function csvList(value?: string): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export function intOpt(value?: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function boolOpt(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

/** YYYY-MM-DD -> [start ISO, end ISO] for that UTC day. */
export function dayRange(date: string): { startTime: string; endTime: string } {
  return {
    startTime: `${date}T00:00:00Z`,
    endTime: `${date}T23:59:59Z`,
  };
}

export function wantsJson(opts?: { json?: boolean }): boolean {
  return Boolean(opts?.json || globalFlags.json);
}
