import { isFunction, pick } from "lodash-es"
import { UrlUtils } from "../utils"

/** Request configuration */
export interface RequestOptions {
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
}

/** 请求响应体 */
export interface ResponseData {
	status: number
	statusText: string
	headers: Headers
	data: any
	options: RequestOptions
}

/** 请求拦截器 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
/** 响应拦截器 */
export type ResponseInterceptor = (response: ResponseData) => Promise<any>
/** 异常拦截器 */
export type ErrorInterceptor = (error: any) => any

export interface RequestConfig extends RequestOptions, RequestInit {}

export class HttpClient {
	private requestInterceptors: Record<string, RequestInterceptor> = {}

	private responseInterceptors: Record<string, ResponseInterceptor> = {}

	private errorInterceptors: Record<string, ErrorInterceptor> = {}

	private baseURL: string

	private controller: AbortController = new AbortController()

	constructor(baseURL: string = "") {
		this.baseURL = baseURL
		this.controller = new AbortController()
	}

	public addRequestInterceptor(interceptor: RequestInterceptor): void {
		this.requestInterceptors[interceptor?.name] = interceptor
	}

	public addResponseInterceptor(interceptor: ResponseInterceptor): void {
		this.responseInterceptors[interceptor?.name] = interceptor
	}

	public addErrorInterceptor(interceptor: ErrorInterceptor): void {
		this.errorInterceptors[interceptor?.name] = interceptor
	}

	public setBaseURL(baseURL: string): void {
		this.baseURL = baseURL
	}

	private getFullURL(url: string): string {
		// If the URL is already fully connected, return directly
		return UrlUtils.join(this.baseURL, url)
	}

	/** Run request interceptor */
	private async runRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
		return Object.values(this.requestInterceptors)?.reduce(
			async (promiseConfig, interceptor) => {
				const currentConfig = await promiseConfig
				return interceptor(currentConfig)
			},
			Promise.resolve(config),
		)
	}

	/** Run response interceptor */
	private async runResponseInterceptors(
		response: Response,
		options: RequestOptions,
	): Promise<any> {
		// First, clone the response object to preserve the original state information
		const responseForStatus = response.clone()

		// Parse JSON data (only needs to be executed once)
		let jsonData
		try {
			jsonData = (await UrlUtils.responseParse(responseForStatus)).data
		} catch (error) {
			// Handling JSON parsing errors
			console.error("Failed to parse response as JSON:", error)
			throw error
		}

		// Pass the original response state and parsed data together to the interceptor
		const initialValue: ResponseData = {
			status: responseForStatus.status,
			statusText: responseForStatus.statusText,
			headers: responseForStatus.headers,
			data: jsonData,
			options,
		}

		// Run interceptor chain
		return Object.values(this.responseInterceptors).reduce(
			async (promiseResult, interceptor) => {
				const currentResult = await promiseResult
				return interceptor(currentResult)
			},
			Promise.resolve(initialValue),
		)
	}

	private async runErrorInterceptors(error: any): Promise<any> {
		const finalError = await Object.values(this.errorInterceptors).reduce(
			async (promiseError, interceptor) => {
				const currentError = await promiseError
				return interceptor(currentError)
			},
			Promise.resolve(error),
		)
		return Promise.reject(finalError)
	}

	public async request<T = any>(config: RequestConfig): Promise<T> {
		try {
			const options = this.genRequestOptions(config)

			const { url, ...finalConfig } = await this.runRequestInterceptors({
				...config,
				...options,
				signal: config?.signal || this.controller.signal,
				url: this.getFullURL(config.url || ""),
			})

			const response = await fetch(url!, finalConfig)

			return await this.runResponseInterceptors(response, options)
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
	public genRequestOptions(config: RequestConfig): RequestOptions {
		return {
			unwrapData: true,
			enableRequestUnion: false,
			enableAuthorization: true,
			enableErrorMessagePrompt: true,
			enableAuthorizationVerification: true,
			...pick(config, [
				"unwrapData",
				"enableRequestUnion",
				"enableAuthorization",
				"enableErrorMessagePrompt",
				"enableAuthorizationVerification",
			]),
		}
	}

	/**
	 * get 请求
	 * @param url 请求URL
	 * @param config 请求配置
	 * @returns unwrapData 为 true 时，返回数据为 T，否则返回 ResponseData
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
