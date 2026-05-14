/**
 * MagicLLMApi
 *
 * 向 iframe 内的 window.Magic.llm 注入大模型对话 API。
 * 所有调用通过 postMessage 委托给主站（parent window）处理。
 * token 由宿主托管，iframe 不能直接拿到 api_key / refresh_token。
 */

import { MagicApiLogger } from "./MagicApiLogger"

interface LLMMessage {
	role: string
	content: string
}

interface LLMOptions {
	model?: string
	temperature?: number
	maxTokens?: number
	systemPrompt?: string
	stream?: boolean
}

interface LLMModelInfo {
	id: string
	object?: string
	owned_by?: string
}

export class MagicLLMApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.llm) return
		MagicApiLogger.info("MagicLLMApi", "install")

		window.Magic.llm = {
			/**
			 * 获取可用模型列表。
			 */
			getModels: (options?: { timeout?: number }): Promise<LLMModelInfo[]> => {
				return new Promise<LLMModelInfo[]>((resolve, reject) => {
					const requestId = `llm_models_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
					MagicApiLogger.info("MagicLLMApi", "getModels:start", {
						requestId,
						timeout: options?.timeout ?? 30_000,
					})

					const timer = setTimeout(() => {
						window.removeEventListener("message", handler)
						MagicApiLogger.error("MagicLLMApi", "getModels:timeout", {
							requestId,
						})
						reject(new Error("LLM getModels request timed out"))
					}, options?.timeout ?? 30_000)

					const handler = (
						event: MessageEvent<{
							type?: string
							requestId?: string
							success?: boolean
							models?: LLMModelInfo[]
							error?: string
						}>,
					) => {
						if (!event.data || event.data.requestId !== requestId) return
						if (event.data.type !== "MAGIC_LLM_GET_MODELS_RESPONSE") return
						clearTimeout(timer)
						window.removeEventListener("message", handler)
						if (event.data.success) {
							MagicApiLogger.info("MagicLLMApi", "getModels:success", {
								requestId,
								modelCount: event.data.models?.length ?? 0,
							})
							resolve(event.data.models ?? [])
						} else {
							MagicApiLogger.error("MagicLLMApi", "getModels:failure", {
								requestId,
								error: event.data.error,
							})
							reject(new Error(event.data.error ?? "Failed to get models"))
						}
					}
					window.addEventListener("message", handler)
					window.parent.postMessage(
						{
							type: "MAGIC_LLM_GET_MODELS_REQUEST",
							requestId,
						},
						"*",
					)
				})
			},

			/**
			 * 一次性对话，返回 Promise<string>。
			 */
			chat: (messages: LLMMessage[], options?: LLMOptions): Promise<string> => {
				return new Promise<string>((resolve, reject) => {
					const requestId = `llm_chat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
					MagicApiLogger.info("MagicLLMApi", "chat:start", {
						requestId,
						messageCount: messages.length,
						options: MagicApiLogger.summarizeOptions(
							options as Record<string, unknown>,
						),
					})

					const timer = setTimeout(() => {
						window.removeEventListener("message", handler)
						MagicApiLogger.error("MagicLLMApi", "chat:timeout", {
							requestId,
						})
						reject(new Error("LLM chat request timed out"))
					}, 120_000)

					const handler = (
						event: MessageEvent<{
							type?: string
							requestId?: string
							success?: boolean
							content?: string
							error?: string
						}>,
					) => {
						if (!event.data || event.data.requestId !== requestId) return
						if (event.data.type !== "MAGIC_LLM_CHAT_RESPONSE") return
						clearTimeout(timer)
						window.removeEventListener("message", handler)
						if (event.data.success) {
							MagicApiLogger.info("MagicLLMApi", "chat:success", {
								requestId,
								content: MagicApiLogger.summarizeText(event.data.content ?? ""),
							})
							resolve(event.data.content ?? "")
						} else {
							MagicApiLogger.error("MagicLLMApi", "chat:failure", {
								requestId,
								error: event.data.error,
							})
							reject(new Error(event.data.error ?? "LLM chat failed"))
						}
					}
					window.addEventListener("message", handler)
					window.parent.postMessage(
						{
							type: "MAGIC_LLM_CHAT_REQUEST",
							requestId,
							messages,
							options: options ?? {},
						},
						"*",
					)
				})
			},

			/**
			 * 流式对话，每个 token 触发 onChunk 回调。
			 * @returns 取消函数
			 */
			stream: (
				messages: LLMMessage[],
				onChunk: (delta: string, done: boolean) => void,
				options?: LLMOptions,
			): (() => void) => {
				const requestId = `llm_stream_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
				let aborted = false
				MagicApiLogger.info("MagicLLMApi", "stream:start", {
					requestId,
					messageCount: messages.length,
					options: MagicApiLogger.summarizeOptions(options as Record<string, unknown>),
				})

				const handler = (
					event: MessageEvent<{
						type?: string
						requestId?: string
						delta?: string
						done?: boolean
						error?: string
					}>,
				) => {
					if (!event.data || event.data.requestId !== requestId) return
					if (aborted) return

					if (event.data.type === "MAGIC_LLM_STREAM_CHUNK") {
						try {
							onChunk(event.data.delta ?? "", !!event.data.done)
						} catch {
							// ignore callback errors
						}
						if (event.data.done) {
							MagicApiLogger.info("MagicLLMApi", "stream:done", { requestId })
							window.removeEventListener("message", handler)
						}
					} else if (event.data.type === "MAGIC_LLM_STREAM_ERROR") {
						MagicApiLogger.error("MagicLLMApi", "stream:failure", {
							requestId,
							error: event.data.error,
						})
						window.removeEventListener("message", handler)
						// 通过 done=true 通知调用方流已结束
						try {
							onChunk("", true)
						} catch {
							// ignore callback errors
						}
					}
				}
				window.addEventListener("message", handler)
				window.parent.postMessage(
					{
						type: "MAGIC_LLM_STREAM_REQUEST",
						requestId,
						messages,
						options: { ...(options ?? {}), stream: true },
					},
					"*",
				)

				return () => {
					if (aborted) return
					aborted = true
					MagicApiLogger.warn("MagicLLMApi", "stream:abort", { requestId })
					window.removeEventListener("message", handler)
					window.parent.postMessage({ type: "MAGIC_LLM_STREAM_ABORT", requestId }, "*")
				}
			},
		}
	}
}
