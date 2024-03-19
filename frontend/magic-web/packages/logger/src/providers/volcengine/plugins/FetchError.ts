import type { WebClient } from "@apmplus/web"

/**
 * Fetch 监控插件配置接口
 */
export interface FetchMonitorPluginOptions {
	/** 是否启用插件 */
	enabled?: boolean
	/** 慢 API 阈值，超过此时间的请求会被标记为慢请求（毫秒，默认 3000） */
	slowApiThreshold?: number
	/** 需要排除的 URL 模式列表，支持字符串和正则表达式 */
	excludeUrls?: (string | RegExp)[]
}

/**
 * API 请求信息接口
 */
interface ApiRequestInfo {
	/** 请求 URL */
	url: string
	/** 请求体 */
	body?: string
	/** 请求头 */
	headers: Record<string, string>
	/** HTTP 请求方法 */
	method: string
	/** 请求开始时间戳 */
	startTime: number
	/** 请求耗时（毫秒） */
	duration?: number
	/** HTTP 响应状态码 */
	status?: number
	/** HTTP 响应状态文本 */
	statusText?: string
	/** 请求过程中的错误信息 */
	error?: Error | string
	/** 业务请求状态码 */
	responseCode?: string
}

/**
 * 检查是否需要监控此请求
 */
function shouldMonitorRequest(url: string, excludeUrls: (string | RegExp)[]): boolean {
	return !excludeUrls.some((pattern) => {
		if (typeof pattern === "string") {
			return url.includes(pattern)
		} else {
			return pattern.test(url)
		}
	})
}

/**
 * 安全提取 URL
 */
function extractUrl(input: RequestInfo | URL): string | null {
	try {
		if (typeof input === "string") {
			return input
		} else if (input instanceof URL) {
			return input.href
		} else {
			return input.url
		}
	} catch {
		return null
	}
}

async function responseParse(response: Response) {
	const contentType = (response.headers.get("Content-Type") || "").toLowerCase()

	if (contentType.includes("application/json")) {
		return { data: await response.json(), type: "json" }
	}
	if (contentType.includes("text/")) {
		return { data: await response.text(), type: "text" }
	}
	if (contentType.includes("image/")) {
		return { data: await response.blob(), type: "blob" }
	}

	return { data: await response.arrayBuffer(), type: "buffer" }
}

export const plugin = (opts?: FetchMonitorPluginOptions) => {
	const options = {
		enabled: true,
		slowApiThreshold: 800, // 3秒
		excludeUrls: [
			/.*\.(js|json|css|png|jpg|jpeg|gif|svg|webp|webm|ico|woff|woff2|ttf|eot|wasm|br|gz)(\?.*)?$/, // 排除静态资源（包含 wasm）
		],
		...opts,
	}

	return {
		name: "customFetch",
		setup: (client: WebClient) => {
			/** 检查是否为慢 api 并上报异常 */
			function checkSlowApi(requestInfo: ApiRequestInfo) {
				if (requestInfo.duration && requestInfo.duration >= options.slowApiThreshold) {
					client("sendEvent", {
						name: "slowApi",
						metrics: {
							duration: requestInfo.duration,
							threshold: options.slowApiThreshold,
							status: requestInfo.status,
							statusText: requestInfo.statusText,
						},
						categories: {
							url: new URL(requestInfo.url, "https://a.com").pathname,
							method: requestInfo.method,
							language: requestInfo.headers["language"],
						},
					})
				}
			}

			/** 上报异常请求 */
			function reportError(requestInfo: ApiRequestInfo, arg: any): void {
				client("sendEvent", {
					name: "apiError",
					metrics: {
						duration: requestInfo.duration,
						status: requestInfo.status,
						statusText: requestInfo.statusText,
						error: requestInfo.error,
					},
					categories: {
						url: new URL(requestInfo.url, "https://a.com").pathname,
						language: requestInfo.headers["language"],
						method: requestInfo.method,
					},
				})
			}

			client.on("start", () => {
				// 拦截全局fetch实现，记录请求信息
				const originalFetch = window.fetch
				window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
					const url = extractUrl(input)
					const method = init?.method || "GET"

					// 检查是否需要监控此请求
					if (!url || !shouldMonitorRequest(url, options.excludeUrls)) {
						return originalFetch.call(this, input, init)
					}

					// 请求头获取
					const headers: Record<string, any> = {}
						; (init?.headers as Headers)?.forEach?.((v, k) => {
							headers[k] = v
						})

					// 创建请求记录
					const requestInfo: ApiRequestInfo = {
						url,
						headers,
						body: typeof init?.body === "string" ? init.body : undefined,
						method: method.toUpperCase(),
						startTime: performance.now(),
					}

					try {
						// 执行原始请求
						const response = await originalFetch.call(this, input, init)
						// 记录成功响应
						requestInfo.duration = performance.now() - requestInfo.startTime
						requestInfo.status = response.status
						requestInfo.statusText = response.statusText

						// 检查是否为慢 api 并上报异常
						checkSlowApi(requestInfo)

						// 采集业务状态码非异常时
						try {
							// 检查HTTP错误状态码
							const jsonData = (await responseParse(response.clone())).data
							const isBusinessError = jsonData?.code && jsonData?.code !== 1000
							const isHttpError = requestInfo.status && requestInfo.status !== 200
							if (isBusinessError || isHttpError) {
								requestInfo.responseCode = jsonData?.code
								reportError(requestInfo, new Error("stack trace"))
							}
						} catch (error) {
							console.error(error)
						}

						return response
					} catch (error: any) {
						// 记录错误响应
						requestInfo.duration = performance.now() - requestInfo.startTime

						// 上报网络错误
						reportError(requestInfo, error)

						throw error
					}
				}
			})
		},
	}
}
