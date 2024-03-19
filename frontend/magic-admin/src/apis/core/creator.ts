import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios"
import axios from "axios"
import { generateErrorInterceptor, generateSuccessResInterceptor } from "./interceptor"

export interface AxiosInstanceConfig {
	baseURL: string
	headers?: Record<string, string>
}

/** Request Context */
export interface RequestConfig extends AxiosRequestConfig {
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

export interface HttpClient {
	<T = any, R = T>(config: RequestConfig): Promise<R>
	<T = any, R = T>(url: string, config?: RequestConfig): Promise<R>
	get<T = any, R = T>(url: string, config?: RequestConfig): Promise<R>
	delete<T = any, R = T>(url: string, data?: any, config?: RequestConfig): Promise<R>
	head<T = any, R = T>(url: string, config?: RequestConfig): Promise<R>
	options<T = any, R = T>(url: string, config?: RequestConfig): Promise<R>
	post<T = any, R = T>(url: string, data?: any, config?: RequestConfig): Promise<R>
	put<T = any, R = T>(url: string, data?: any, config?: RequestConfig): Promise<R>
	request<T = any, R = T>(config: RequestConfig): Promise<R>
}

export function createAxiosInstance(config: AxiosInstanceConfig) {
	const instance = axios.create({
		baseURL: config.baseURL,
	})

	// 请求拦截器
	instance.interceptors.request.use((requestConfig: InternalAxiosRequestConfig) => {
		if (config.headers) {
			Object.entries(config.headers).forEach(([key, value]) => {
				requestConfig.headers.set(key, value)
			})
		}
		return requestConfig
	})

	// 响应拦截器
	instance.interceptors.response.use(generateSuccessResInterceptor(), generateErrorInterceptor())

	// 添加泛型支持
	return instance as HttpClient
}
