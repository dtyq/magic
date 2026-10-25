import { UrlUtils } from "./serialization"
import { appendQueryParams } from "./query"
import { HttpDisposedError } from "./errors"
import { PendingRequests } from "./deduplication"
import type {
	RequestConfig,
	ResponseConfig,
	PreparedRequest,
	InterceptorContext,
	RequestInterceptor,
	ResponseInterceptor,
	ErrorInterceptor,
	AddInterceptorOptions,
	HttpClientParams,
} from "./types"

export type * from "./types"

/** One transport pipeline shared by raw HTTP and all service adapters. */
export class HttpClient<E extends object = object> {
	private readonly requestInterceptors: RequestInterceptor<E>[] = []
	private readonly responseInterceptors: ResponseInterceptor<E>[] = []
	private readonly errorInterceptors: ErrorInterceptor[] = []
	private readonly pending = new PendingRequests()
	private controller = new AbortController()
	private disposed = false
	protected baseURL: string
	private readonly fetcher: typeof fetch
	private readonly onError?: (error: unknown) => void

	constructor(options: HttpClientParams) {
		this.baseURL = options.baseURL
		this.fetcher = options.fetch ?? ((...args) => globalThis.fetch(...args))
		this.onError = options.onError
	}

	addRequestInterceptor(fn: RequestInterceptor<E>, options?: AddInterceptorOptions) {
		return this.addInterceptor(this.requestInterceptors, fn, options)
	}
	addResponseInterceptor(fn: ResponseInterceptor<E>, options?: AddInterceptorOptions) {
		return this.addInterceptor(this.responseInterceptors, fn, options)
	}
	addErrorInterceptor(fn: ErrorInterceptor, options?: AddInterceptorOptions) {
		return this.addInterceptor(this.errorInterceptors, fn, options)
	}
	private addInterceptor<T>(list: T[], fn: T, options?: AddInterceptorOptions) {
		if (options?.position === "head") list.unshift(fn)
		else list.push(fn)
		return () => {
			const i = list.indexOf(fn)
			if (i >= 0) list.splice(i, 1)
		}
	}
	setBaseURL(baseURL: string) {
		this.baseURL = baseURL
		this.pending.clear()
	}
	protected defaults(): Partial<E> {
		return {}
	}
	protected selectResponse(context: InterceptorContext<E>): unknown {
		return context.response
	}
	protected requestKey(_request: PreparedRequest<E>): string | undefined {
		return undefined
	}
	protected assertCurrent(_request: PreparedRequest<E>): void {
		/* Service scope hook. */
	}
	protected copyHeaderContext(_source: Headers, _target: Headers): void {
		/* Preserve adapter metadata when a header callback returns a new object. */
	}
	validateRequest(request: PreparedRequest<E>) {
		this.assertActive(request.signal)
		this.assertCurrent(request)
	}

	private assertActive(signal?: AbortSignal | null) {
		if (this.disposed) throw new HttpDisposedError()
		if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError")
	}

	/** Both caller cancellation and owner disposal apply, including while a gate waits. */
	private createSignal(external?: AbortSignal | null) {
		const controller = new AbortController()
		const inputs = [this.controller.signal, external].filter((s): s is AbortSignal => !!s)
		const abort = () => controller.abort(inputs.find((s) => s.aborted)?.reason)
		for (const signal of inputs) signal.addEventListener("abort", abort, { once: true })
		if (inputs.some((s) => s.aborted)) abort()
		return {
			signal: controller.signal,
			dispose: () => inputs.forEach((s) => s.removeEventListener("abort", abort)),
		}
	}

	private async prepare(config: RequestConfig & E, signal: AbortSignal) {
		let request = {
			baseURL: this.baseURL,
			...this.defaults(),
			...config,
			signal,
			url: config.url ?? "",
			headers: new Headers(typeof config.headers === "function" ? {} : config.headers),
		} as PreparedRequest<E>
		if (config.headers instanceof Headers)
			this.copyHeaderContext(config.headers, request.headers!)
		for (const interceptor of [...this.requestInterceptors]) {
			this.assertActive(signal)
			const headers = request.headers
			request = await interceptor(request)
			if (headers && request.headers && headers !== request.headers)
				this.copyHeaderContext(headers, request.headers)
		}
		this.assertActive(signal)
		if (typeof config.headers === "function") {
			const headers = request.headers!
			request.headers = new Headers(config.headers(headers))
			this.copyHeaderContext(headers, request.headers)
		}
		// Remove consumed params so response-driven retries cannot append them twice.
		const { params, ...prepared } = request
		return {
			...prepared,
			signal,
			url: appendQueryParams(UrlUtils.join(request.baseURL ?? "", request.url ?? ""), params),
		} as PreparedRequest<E>
	}

	private send(request: PreparedRequest<E>) {
		this.assertActive(request.signal)
		this.assertCurrent(request)
		// Only browser request fields reach fetch; adapter metadata remains internal.
		const {
			method,
			headers,
			body,
			signal,
			cache,
			credentials,
			integrity,
			keepalive,
			mode,
			redirect,
			referrer,
			referrerPolicy,
			priority,
		} = request
		return this.fetcher(request.url!, {
			method,
			headers,
			body,
			signal,
			cache,
			credentials,
			integrity,
			keepalive,
			mode,
			redirect,
			referrer,
			referrerPolicy,
			priority,
		})
	}

	private async dispatch(request: PreparedRequest<E>) {
		const response = await this.send(request)
		const parsed = await UrlUtils.responseParse(response, request)
		this.assertActive(request.signal)
		this.assertCurrent(request)
		let context: InterceptorContext<E> = {
			http: this,
			request,
			response: {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				data: parsed.data,
			},
		}
		for (const interceptor of [...this.responseInterceptors]) {
			this.assertActive(request.signal)
			this.assertCurrent(request)
			context = await interceptor(context)
		}
		this.assertActive(request.signal)
		this.assertCurrent(request)
		return this.selectResponse(context)
	}

	async request<T = ResponseConfig>(config: RequestConfig & E): Promise<T> {
		const owned = this.createSignal(config.signal)
		try {
			let prepared: PreparedRequest<E>
			let key: string | undefined
			try {
				this.assertActive(owned.signal)
				prepared = await this.prepare(config, owned.signal)
				// Independent callers retain independent cancellation until a subscriber model exists.
				key = config.signal ? undefined : this.requestKey(prepared)
			} catch (error) {
				return await this.rejectWithInterceptors(error)
			}
			// A shared execution owns final error effects; subscribers only observe its rejection.
			return (await this.pending.run(key, () =>
				this.dispatch(prepared).catch((error) => this.rejectWithInterceptors(error)),
			)) as T
		} finally {
			owned.dispose()
		}
	}

	private async rejectWithInterceptors(caught: unknown): Promise<never> {
		try {
			this.onError?.(caught)
		} catch {
			// A diagnostic sink must not replace the original request failure.
		}
		let error = caught
		for (const interceptor of [...this.errorInterceptors]) error = await interceptor(error)
		throw error
	}

	/** Compatibility raw retry: same preparation/send path, without recursive response handling. */
	async retry(config: RequestConfig & E): Promise<Response> {
		const owned = this.createSignal(config.signal)
		try {
			const request = await this.prepare(config, owned.signal)
			const response = await this.send(request)
			this.assertActive(owned.signal)
			this.assertCurrent(request)
			return response
		} finally {
			owned.dispose()
		}
	}

	get<T = any>(url: string, config?: Omit<RequestConfig & E, "url">): Promise<T> {
		return this.request<T>({ ...config, url, method: "GET" } as RequestConfig & E)
	}

	post<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig & E, "url" | "body">,
	): Promise<T> {
		return this.write<T>("POST", url, data, config)
	}

	put<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig & E, "url" | "body">,
	): Promise<T> {
		return this.write<T>("PUT", url, data, config)
	}

	patch<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig & E, "url" | "body">,
	): Promise<T> {
		return this.write<T>("PATCH", url, data, config)
	}

	delete<T = any>(url: string, data?: any, config?: Omit<RequestConfig & E, "url">): Promise<T> {
		return this.request<T>({
			...config,
			url,
			method: "DELETE",
			body: JSON.stringify(data),
		} as RequestConfig & E)
	}

	private write<T>(
		method: string,
		url: string,
		data: any,
		config?: Omit<RequestConfig & E, "url" | "body">,
	) {
		return this.request<T>({
			...config,
			url,
			method,
			body: JSON.stringify(data),
		} as RequestConfig & E)
	}

	async abort(callback?: () => Promise<void>) {
		this.controller.abort()
		this.pending.clear()
		this.controller = new AbortController()
		if (callback) await callback()
	}
	dispose() {
		if (this.disposed) return
		this.disposed = true
		this.controller.abort()
		this.pending.clear()
		this.requestInterceptors.length = 0
		this.responseInterceptors.length = 0
		this.errorInterceptors.length = 0
	}
}
