import type * as Core from "../types"
import type { ServiceHttpClient } from "./ServiceHttpClient"

/** Legacy API flags live at the service boundary, never in the transport contract. */
export interface ServiceRequestOptions {
	unwrapData?: boolean
	enableAuthorization?: boolean
	enableErrorMessagePrompt?: boolean
	enableAuthorizationVerification?: boolean
	/**
	 * Opt in to sharing equivalent in-flight executions for any method.
	 * Always ignores request-id, including caller-supplied IDs, when comparing requests.
	 * Final headers/body/options and the application partition must match. Caller signals,
	 * non-string bodies and missing partition keys keep executions independent.
	 */
	enableRequestUnion?: boolean
	skipAppInitWait?: boolean
	swCacheOption?: "cache" | "no-cache" | "default"
	authRetryAttempt?: 0 | 1
}
export type RequestConfig<T = HeadersInit | ((headers: Headers) => Headers)> =
	Core.RequestConfig<T> & ServiceRequestOptions

export type InterceptorContext = Core.InterceptorContext<ServiceRequestOptions>
export type RequestInterceptor = Core.RequestInterceptor<ServiceRequestOptions>
export type ResponseInterceptor = Core.ResponseInterceptor<ServiceRequestOptions>

export type {
	ResponseConfig,
	ErrorInterceptor,
	AddInterceptorOptions,
	QueryParams,
	QueryScalar,
} from "../types"

export interface HttpClientParams extends Core.HttpClientParams {
	getBaseURL?: (clusterCode: string) => string
}

export interface RequestContextProvider<Scope extends object = object> {
	/** Return a per-request snapshot; the provider must not mutate it after capture. */
	resolve(): Scope
	isCurrent(snapshot: Scope): boolean
	/** Opaque partition key; omit to disable sharing. Never include raw credentials. */
	getKey?(snapshot: Scope): string | undefined
}

/** Application interceptors receive the captured scope, including during retries. */
export type ScopedRequestInterceptor<Scope extends object = object> = (
	config: RequestConfig<Headers>,
	snapshot: Scope,
) => ReturnType<RequestInterceptor>

export interface ServiceClientBindings<Scope extends object = object> extends HttpClientParams {
	context: RequestContextProvider<Scope>
	readiness: { wait(signal?: AbortSignal | null): Promise<void> }
	requestInterceptors?: ScopedRequestInterceptor<Scope>[]
	responseInterceptors?: ResponseInterceptor[]
}

export interface OwnedServiceClient {
	client: ServiceHttpClient
	dispose(): void
}
