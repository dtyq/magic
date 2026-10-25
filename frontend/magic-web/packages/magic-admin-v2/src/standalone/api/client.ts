import axios, { type AxiosRequestConfig, type Method } from "axios";
import type {
  ApiError,
  HttpClient,
  RequestOptions,
} from "@magic-admin-v2/api/types";
import type { StandaloneRequestContext } from "@magic-admin-v2/standalone/api/context";
import { getRequestFailedMessage } from "@magic-admin-v2/standalone/api/fallback-messages";

type ApiEnvelope<T> = {
  code: number | string;
  data: T;
  error?: unknown;
  message?: string;
};

type ApiErrorResponse = {
  code?: unknown;
  data?: unknown;
  error?: unknown;
  message?: unknown;
};

type CreateStandaloneHttpClientOptions = {
  baseURL: string;
  context: StandaloneRequestContext;
  getAuthorization: () => string;
  getOrganizationCode: () => string;
  onUnauthorized: (error: ApiError) => void;
  service: NonNullable<ApiError["service"]>;
};

export function createStandaloneHttpClient({
  baseURL,
  context,
  getAuthorization,
  getOrganizationCode,
  onUnauthorized,
  service,
}: CreateStandaloneHttpClientOptions): HttpClient {
  const instance = axios.create({
    baseURL: baseURL || undefined,
    timeout: 15_000,
    headers: { "Content-Type": "application/json" },
  });
  let unauthorizedNotified = false;

  async function request<T, D = unknown>(
    method: Method,
    url: string,
    data?: D,
    options?: RequestOptions,
  ): Promise<T> {
    const headers = new Headers(options?.headers);
    const authorization = getAuthorization();
    const organizationCode = getOrganizationCode();

    if (authorization && !headers.has("authorization")) {
      headers.set("authorization", authorization);
    }
    if (organizationCode && !headers.has("organization-code")) {
      headers.set("organization-code", organizationCode);
    }
    if (!headers.has("language")) {
      headers.set("language", context.getLanguage());
    }
    if (!headers.has("request-id")) {
      headers.set("request-id", createRequestId());
    }

    const config: AxiosRequestConfig<D> = {
      data,
      headers: Object.fromEntries(headers.entries()),
      method,
      signal: options?.signal,
      url,
    };

    try {
      const response = await instance.request(config);
      if (options?.unwrapData === false || !hasApiEnvelopeShape(response.data)) {
        return response.data as T;
      }
      if (!isSuccessCode(response.data.code)) {
        throw normalizeBusinessError(
          response.data,
          response.status,
          service,
          context,
        );
      }
      return response.data.data as T;
    } catch (error) {
      const apiError = isApiError(error)
        ? error
        : normalizeRequestError(error, context, service);
      if (isUnauthorized(apiError) && !unauthorizedNotified) {
        unauthorizedNotified = true;
        onUnauthorized(apiError);
      }
      throw apiError;
    }
  }

  return {
    get: <T>(url: string, options?: RequestOptions) =>
      request<T>("GET", url, undefined, options),
    post: <T, D = unknown>(url: string, data?: D, options?: RequestOptions) =>
      request<T, D>("POST", url, data, options),
    put: <T, D = unknown>(url: string, data?: D, options?: RequestOptions) =>
      request<T, D>("PUT", url, data, options),
    patch: <T, D = unknown>(url: string, data?: D, options?: RequestOptions) =>
      request<T, D>("PATCH", url, data, options),
    delete: <T, D = unknown>(url: string, data?: D, options?: RequestOptions) =>
      request<T, D>("DELETE", url, data, options),
  };
}

function normalizeRequestError(
  error: unknown,
  context: StandaloneRequestContext,
  service: NonNullable<ApiError["service"]>,
): ApiError {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return {
      code: "REQUEST_ERROR",
      message:
        error instanceof Error
          ? error.message
          : getRequestFailedMessage(context.getLanguage()),
      service,
      cause: error,
    };
  }

  const response = error.response?.data;
  return {
    code:
      typeof response?.code === "string" || typeof response?.code === "number"
        ? String(response.code)
        : "REQUEST_ERROR",
    message:
      typeof response?.message === "string" && response.message.trim()
        ? response.message
        : getRequestFailedMessage(context.getLanguage()),
    status: error.response?.status,
    details: response?.error
      ? { data: response.data, error: response.error }
      : response?.data,
    service,
    cause: error,
  };
}

function normalizeBusinessError(
  envelope: ApiEnvelope<unknown>,
  status: number,
  service: NonNullable<ApiError["service"]>,
  context: StandaloneRequestContext,
): ApiError {
  return {
    code: String(envelope.code),
    message:
      typeof envelope.message === "string" && envelope.message.trim()
        ? envelope.message
        : getRequestFailedMessage(context.getLanguage()),
    status,
    details: envelope.error
      ? { data: envelope.data, error: envelope.error }
      : envelope.data,
    service,
  };
}

function hasApiEnvelopeShape(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === "object" && value !== null && "code" in value && "data" in value;
}

function isSuccessCode(code: number | string) {
  return ["0", "1000", "200"].includes(String(code));
}

function isUnauthorized(error: ApiError) {
  return (
    error.status === 401 ||
    ["401", "2185", "2179", "3103"].includes(error.code)
  );
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
