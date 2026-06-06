import { isFunction, pick } from "lodash-es"
import { UrlUtils } from "../utils"

/** Request Context */
interface RequestContext {
	/** Base URL */
	baseURL?: string
	/** Request URL Path */
	url?: string
	/** want to unpack the data */
	unwrapData?: boolean
	/** Enable authorization request header */
	enableAuthorization?: boolean
	/** Whether to display error messages */
	enableErrorMessagePrompt?: boolean
	/** Enable authorization request verification (401 not submitted for verification) */
	enableAuthorizationVerification?: boolean
	/** Enable request deduplication */
	enableRequestUnion?: boolean
	/** Skip app-init wait in magic client (rare escape hatch) */
	skipAppInitWait?: boolean
	/** Service Worker API 缓存配置选项 */
	swCacheOption?: "cache" | "no-cache" | "default"
	/** Quote 16+ digit JSON integers as strings before parse (snowflake IDs) */
	parseJsonLargeIntAsString?: boolean
}

/** Response body */
export interface ResponseConfig {
	status: number
	statusText: string
	headers: Headers
	data: any
}

/** Request Config */
export interface RequestConfig<T = HeadersInit | ((headers: Headers) => Headers)>
	extends RequestContext, Omit<RequestInit, "headers"> {
	headers?: T
}

/** 拦截器上下文 */
export interface InterceptorContext {
	http: HttpClient
	request: RequestConfig<Headers>
	response: ResponseConfig
}

/** 请求拦截器 */
export type RequestInterceptor = (
	config: RequestConfig<Headers>,
) => RequestConfig<Headers> | Promise<RequestConfig<Headers>>

/** 响应拦截器 */
export type ResponseInterceptor = (context: InterceptorContext) => Promise<InterceptorContext>

/** 异常拦截器 */
export type ErrorInterceptor = (error: any) => any

export interface AddInterceptorOptions {
	position?: "head" | "tail"
}

export interface HttpClientParams {
	baseURL: string
	/** 注入集群编码，返回对应集群编码的地址 */
	getBaseURL: (clusterCode: string) => string
}

export class HttpClient {
	private requestInterceptors: RequestInterceptor[] = []

	private responseInterceptors: ResponseInterceptor[] = []

	private errorInterceptors: ErrorInterceptor[] = []

	private baseURL: string
	public getBaseURL: (clusterCode: string) => string

	private controller: AbortController = new AbortController()

	constructor(options: HttpClientParams) {
		this.baseURL = options.baseURL
		this.getBaseURL = options.getBaseURL
		this.controller = new AbortController()
	}

	public addRequestInterceptor(
		interceptor: RequestInterceptor,
		options?: AddInterceptorOptions,
	): () => void {
		return this.addInterceptor(this.requestInterceptors, interceptor, options)
	}

	public addResponseInterceptor(
		interceptor: ResponseInterceptor,
		options?: AddInterceptorOptions,
	): () => void {
		return this.addInterceptor(this.responseInterceptors, interceptor, options)
	}

	public addErrorInterceptor(
		interceptor: ErrorInterceptor,
		options?: AddInterceptorOptions,
	): () => void {
		return this.addInterceptor(this.errorInterceptors, interceptor, options)
	}

	public setBaseURL(baseURL: string): void {
		this.baseURL = baseURL
	}

	private addInterceptor<T>(
		interceptors: T[],
		interceptor: T,
		options?: AddInterceptorOptions,
	): () => void {
		if (options?.position === "head") interceptors.unshift(interceptor)
		else interceptors.push(interceptor)

		return () => {
			const index = interceptors.indexOf(interceptor)
			if (index === -1) return
			interceptors.splice(index, 1)
		}
	}

	private getFullURL(url: string, baseURL = this.baseURL): string {
		// If the URL is already fully connected, return directly
		return UrlUtils.join(baseURL, url)
	}

	/** Run request interceptor */
	private async runRequestInterceptors(
		config: RequestConfig<Headers>,
	): Promise<RequestConfig<Headers>> {
		return this.requestInterceptors.reduce(async (promiseConfig, interceptor) => {
			const currentConfig = await promiseConfig
			return interceptor(currentConfig)
		}, Promise.resolve(config))
	}

	/** Run response interceptor */
	private async runResponseInterceptors(
		request: RequestConfig<Headers>,
		response: Response,
	): Promise<any> {
		// First, clone the response object to preserve the original state information
		const responseForStatus = response.clone()

		// Parse JSON data (only needs to be executed once)
		const jsonData = (
			await UrlUtils.responseParse(responseForStatus, {
				parseJsonLargeIntAsString: request.parseJsonLargeIntAsString,
			})
		).data

		// Pass the original response state and parsed data together to the interceptor
		const initialValue: InterceptorContext = {
			http: this,
			request,
			response: {
				status: responseForStatus.status,
				statusText: responseForStatus.statusText,
				headers: responseForStatus.headers,
				data: jsonData,
			},
		}

		// Run interceptor chain
		return this.responseInterceptors.reduce(async (promiseResult, interceptor) => {
			const currentResult = await promiseResult
			return interceptor(currentResult)
		}, Promise.resolve(initialValue))
	}

	private async runErrorInterceptors(error: any): Promise<any> {
		const finalError = await this.errorInterceptors.reduce(
			async (promiseError, interceptor) => {
				const currentError = await promiseError
				return interceptor(currentError)
			},
			Promise.resolve(error),
		)
		return Promise.reject(finalError)
	}

	async retry(config: RequestConfig): Promise<Response> {
		const requestContext = this.genRequestContext(config)

		const { url, baseURL, ...req } = await this.runRequestInterceptors({
			...config,
			...requestContext,
			headers: new Headers(isFunction(config?.headers) ? {} : config?.headers),
			signal: config?.signal || this.controller.signal,
			url: config.url || "",
		})
		const fullURL = this.getFullURL(url || "", baseURL)

		if (isFunction(config?.headers)) {
			req.headers = config?.headers(req.headers as Headers)
		}

		return await fetch(fullURL, req as RequestInit)
	}

	public async request<T = any>(config: RequestConfig): Promise<T> {
		try {
			const requestContext = this.genRequestContext(config)

			const { url, baseURL, ...req } = await this.runRequestInterceptors({
				...config,
				...requestContext,
				headers: new Headers(isFunction(config?.headers) ? {} : config?.headers),
				signal: config?.signal || this.controller.signal,
				url: config.url || "",
			})
			const fullURL = this.getFullURL(url || "", baseURL)

			if (isFunction(config?.headers)) {
				req.headers = config?.headers(req.headers as Headers)
			}

			const res = await fetch(fullURL, req as RequestInit)

			const { request, response } = await this.runResponseInterceptors(
				{ url: fullURL, baseURL, ...req },
				res,
			)

			// 解包数据
			if (request?.unwrapData) {
				return response?.data?.data
			}

			return response
		} catch (error) {
			console.error("Request failed:", error)
			return this.runErrorInterceptors(error)
		}
	}

	/**
	 * 获取请求配置
	 * @param config 请求配置
	 * @returns 请求配置
	 */
	private genRequestContext(config: RequestConfig): RequestContext {
		return {
			baseURL: this.baseURL,
			unwrapData: true,
			enableRequestUnion: false,
			enableAuthorization: true,
			enableErrorMessagePrompt: true,
			enableAuthorizationVerification: true,
			...pick(config, [
				"baseURL",
				"unwrapData",
				"enableRequestUnion",
				"enableAuthorization",
				"enableErrorMessagePrompt",
				"enableAuthorizationVerification",
				"skipAppInitWait",
				"parseJsonLargeIntAsString",
			]),
		}
	}

	/**
	 * get 请求
	 * @param url 请求URL
	 * @param config 请求配置
	 * @returns unwrapData 为 true 时，返回数据为 T，否则返回 ResponseConfig
	 */
	public async get<T = any>(url: string, config?: Omit<RequestConfig, "url">): Promise<T> {
		return this.request({
			...config,
			url,
			method: "GET",
		})
	}

	public async post<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig, "url" | "body">,
	): Promise<T> {
		return this.request({
			...config,
			url,
			method: "POST",
			body: JSON.stringify(data),
		})
	}

	public async put<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig, "url" | "body">,
	): Promise<T> {
		return this.request({
			...config,
			url,
			method: "PUT",
			body: JSON.stringify(data),
		})
	}

	public async delete<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig, "url">,
	): Promise<T> {
		return this.request({
			...config,
			url,
			method: "DELETE",
			body: JSON.stringify(data),
		})
	}

	public async patch<T = any>(
		url: string,
		data?: any,
		config?: Omit<RequestConfig, "url" | "body">,
	): Promise<T> {
		return this.request({
			...config,
			url,
			method: "PATCH",
			body: JSON.stringify(data),
		})
	}

	/**
	 * @description 取消请求队列中的所有请求
	 */
	public async abort(callback?: () => Promise<void>): Promise<void> {
		this.controller?.abort?.()
		try {
			if (isFunction(callback)) {
				await callback?.()
			}
		} catch (error) {
			console.error("abort fetch error", error)
		} finally {
			this.controller = new AbortController()
		}
	}
}
