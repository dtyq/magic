import type { EditionClients } from "@magic-admin-v2/api/edition-clients";

export type RequestOptions = {
  signal?: AbortSignal;
  timeout?: number;
  headers?: HeadersInit;
  unwrapData?: boolean;
  /** Embedded host clients use this to suppress their global error toast. */
  enableErrorMessagePrompt?: boolean;
  /** Legacy request options accepted by the approval renderer adapter. */
  version?: string;
  cache?: boolean;
  autoErrorAlert?: boolean;
  enableAuthorization?: boolean;
  enableAuthorizationVerification?: boolean;
  enableRequestUnion?: boolean;
};

/** Structural subset shared by the host HttpClient and the standalone adapter. */
export interface HttpClient {
  get<T>(url: string, options?: RequestOptions): Promise<T>;
  post<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T>;
  put<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T>;
  patch<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T>;
  delete<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T>;
}

export type ApiClients = {
  magic: HttpClient;
} & EditionClients;

export type ApiError = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  service?: "magic" | "teamshare" | "keewood";
  cause?: unknown;
};

export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  return (
    candidate.status === 401 ||
    ["401", "2185", "2179", "3103"].includes(String(candidate.code ?? "")) ||
    candidate.message === "Unauthorized"
  );
}

export function isPlatformPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.status === 403 || String(candidate.code ?? "") === "70007";
}
