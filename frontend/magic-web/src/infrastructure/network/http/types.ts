import type { HttpClient } from "./HttpClient"
import type { QueryParams } from "./query"

export type { QueryParams, QueryScalar } from "./query"

/** Transport options contain no session, service protocol or UI policy. */
export interface RequestConfig<T = HeadersInit | ((headers: Headers) => Headers)> extends Omit<
	RequestInit,
	"headers"
> {
	url?: string
	baseURL?: string
	headers?: T
	params?: QueryParams
	parseJsonLargeIntAsString?: boolean
}

export interface ResponseConfig {
	status: number
	statusText: string
	headers: Headers
	data: any
}

export type PreparedRequest<E extends object = object> = RequestConfig<Headers> & E
export interface InterceptorContext<E extends object = object> {
	http: HttpClient<E>
	request: PreparedRequest<E>
	response: ResponseConfig
}
export type RequestInterceptor<E extends object = object> = (
	config: PreparedRequest<E>,
) => PreparedRequest<E> | Promise<PreparedRequest<E>>
export type ResponseInterceptor<E extends object = object> = (
	context: InterceptorContext<E>,
) => Promise<InterceptorContext<E>>
export type ErrorInterceptor = (error: any) => any
export interface AddInterceptorOptions {
	position?: "head" | "tail"
}
export interface HttpClientParams {
	baseURL: string
	/** Resolve at call time by default, so Mock and instrumentation can replace fetch. */
	fetch?: typeof fetch
	/** Optional diagnostics are injected; the core never imports a logger or business store. */
	onError?: (error: unknown) => void
}
