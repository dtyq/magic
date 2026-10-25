import { HttpClient } from "../HttpClient"
import { createReadinessInterceptor } from "../interceptors/readiness"
import { RequestContext } from "../interceptors/requestContext"
import sha256 from "crypto-js/sha256"
import type {
	HttpClientParams,
	InterceptorContext,
	RequestConfig,
	ServiceClientBindings,
	ServiceRequestOptions,
} from "./types"

/** Service flags and envelope compatibility surround the single generic executor. */
export class ServiceHttpClient<
	Scope extends object = object,
> extends HttpClient<ServiceRequestOptions> {
	readonly getBaseURL: (clusterCode: string) => string
	// Expose only context operations without payload types to runtime/API consumers.
	private readonly requestContext?: Pick<RequestContext, "assertCurrent" | "copy" | "getKey">

	constructor(options: HttpClientParams, bindings?: ServiceClientBindings<Scope>) {
		super(options)
		this.getBaseURL = options.getBaseURL ?? (() => options.baseURL)
		if (bindings) {
			const context = new RequestContext(bindings.context)
			this.requestContext = context
			this.addRequestInterceptor(createReadinessInterceptor(bindings.readiness))
			this.addRequestInterceptor((request) => context.capture(request))
			for (const interceptor of bindings.requestInterceptors ?? [])
				this.addRequestInterceptor((config) => {
					context.assertCurrent(config)
					return interceptor(config, context.getSnapshot(config))
				})
			for (const interceptor of bindings.responseInterceptors ?? [])
				this.addResponseInterceptor(interceptor)
		}
	}

	request<T = any>(config: RequestConfig): Promise<T> {
		return super.request<T>(config)
	}

	async abort(callback?: () => Promise<void>): Promise<void> {
		await super.abort(async () => {
			try {
				await callback?.()
			} catch (error) {
				// Preserve the legacy logout contract: failure of the cleanup request
				// must not prevent the caller's remaining local session cleanup.
				console.error("abort fetch error", error)
			}
		})
	}

	protected defaults(): ServiceRequestOptions {
		return {
			unwrapData: true,
			enableRequestUnion: false,
			enableAuthorization: true,
			enableErrorMessagePrompt: true,
			enableAuthorizationVerification: true,
		}
	}

	protected selectResponse({ request, response }: InterceptorContext) {
		return request.unwrapData ? response.data?.data : response
	}

	protected assertCurrent(request: RequestConfig<Headers>) {
		this.requestContext?.assertCurrent(request)
	}
	protected copyHeaderContext(source: Headers, target: Headers) {
		this.requestContext?.copy(source, target)
	}

	protected requestKey(request: RequestConfig<Headers>) {
		if (!request.enableRequestUnion) return undefined
		const scopeKey = this.requestContext?.getKey(request)
		if (scopeKey === undefined) return undefined
		// Compare the serialized body, not the original JS object. Do not consume streams
		// or inspect multipart/binary payloads merely to decide whether to share a request.
		if (request.body != null && typeof request.body !== "string") return undefined
		// Headers normalizes casing and iteration order. Compare after all interceptors
		// and the caller's header callback, including explicit empty headers and credentials.
		// Keep credentials and payloads out of pending-map keys by hashing the descriptor.
		return sha256(
			JSON.stringify([
				scopeKey,
				// Preserve custom method case; different method tokens must never collide.
				request.method ?? "GET",
				request.url,
				request.body ?? null,
				// Opt-in permits sharing across IDs for every method. Keep the actual
				// sending request's ID on the wire and preserve it during retries.
				Array.from(request.headers ?? []).filter(([name]) => name !== "request-id"),
				request.unwrapData,
				request.enableErrorMessagePrompt,
				request.enableAuthorization,
				request.enableAuthorizationVerification,
				request.skipAppInitWait,
				request.parseJsonLargeIntAsString,
				request.credentials,
				request.cache,
				request.integrity,
				request.keepalive,
				request.mode,
				request.redirect,
				request.referrer,
				request.referrerPolicy,
				request.priority,
				request.authRetryAttempt,
			]),
		).toString()
	}
}
