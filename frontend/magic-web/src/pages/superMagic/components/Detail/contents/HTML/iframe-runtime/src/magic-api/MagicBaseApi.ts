/**
 * MagicBaseApi
 *
 * 所有 Magic API 类的抽象基类，提供统一的 postMessage request/response 模式。
 * 子类通过 this.request<T>() 发起请求，无需重复实现超时、requestId 生成、
 * 消息监听和清理逻辑。
 */

import { MagicApiLogger } from "./MagicApiLogger"

export abstract class MagicBaseApi {
	/**
	 * 向主站（parent window）发起一次 postMessage 请求并等待响应。
	 *
	 * @param type          消息类型（REQUEST 侧，例如 "MAGIC_FS_READ_REQUEST"）
	 * @param payload       额外载荷，会合并到 postMessage 消息体中
	 * @param timeout       超时毫秒数，默认 15000ms
	 * @param extractResult 从响应数据中提取结果的函数；
	 *                      若不传则默认取 `data.content ?? data`
	 */
	protected request<T>(
		type: string,
		payload: Record<string, unknown>,
		timeout = 15000,
		extractResult?: (data: Record<string, unknown>) => T,
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const requestId = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
			const responseType = type.replace(/_REQUEST$/, "_RESPONSE")
			const api = this.constructor.name

			MagicApiLogger.info(api, "request:start", {
				type,
				requestId,
				timeout,
			})

			const timer = setTimeout(() => {
				window.removeEventListener("message", handler)
				MagicApiLogger.error(api, "request:timeout", {
					type,
					requestId,
					timeout,
				})
				reject(new Error(`${type} request timed out`))
			}, timeout)

			const handler = (event: MessageEvent<Record<string, unknown>>) => {
				if (!event.data || event.data["requestId"] !== requestId) return
				if (event.data["type"] !== responseType) return
				clearTimeout(timer)
				window.removeEventListener("message", handler)
				if (event.data["success"]) {
					const result = extractResult
						? extractResult(event.data)
						: ((event.data["content"] ?? event.data) as T)
					MagicApiLogger.info(api, "request:success", {
						type,
						requestId,
					})
					resolve(result)
				} else {
					MagicApiLogger.error(api, "request:failure", {
						type,
						requestId,
						error:
							typeof event.data["error"] === "string"
								? event.data["error"]
								: undefined,
					})
					reject(new Error((event.data["error"] as string) ?? `${type} request failed`))
				}
			}
			window.addEventListener("message", handler)
			window.parent.postMessage({ type, requestId, ...payload }, "*")
		})
	}
}
