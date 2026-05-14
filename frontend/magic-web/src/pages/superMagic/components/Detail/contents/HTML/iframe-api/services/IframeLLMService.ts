/**
 * IframeLLMService
 *
 * 处理 MAGIC_LLM_* 消息，为宿主（parent window）提供
 * LLM token 管理、模型列表获取、chat 调用与 stream 转发能力。
 * 纯 class，不依赖 React，由 useIframeLLM hook 持有实例。
 *
 * 安全要点：token（api_key / refresh_token）仅保留在宿主内存，
 * 绝不通过 postMessage 暴露给 iframe。
 */

import {
	LLM_MESSAGE_TYPES,
	type LLMChatRequest,
	type LLMGetModelsRequest,
	type LLMStreamRequest,
	type LLMStreamAbort,
	type LLMOptions,
	type LLMMessage,
	type LLMUsage,
} from "../types"
// ─── 内部类型 ────────────────────────────────────────────────────────────────

interface ModelGatewayToken {
	apiKey: string
	refreshToken: string
	/** 过期时间戳（毫秒） */
	expiresAt: number
}

export interface IframeLLMConfig {
	/** 向 iframe 发送消息的函数 */
	postToIframe: (message: object) => void
	/** Magic 主站 API 基地址（例如 https://api.example.com） */
	baseUrl: string
	/** 获取当前用户 authorization 的函数 */
	getAuthorization: () => string
	/** 获取当前组织代码的函数 */
	getOrganizationCode: () => string
}

/** token 过期前提前刷新的缓冲时间（毫秒） */
const TOKEN_REFRESH_BUFFER_MS = 60_000
/** 聊天请求的超时时间（毫秒） */
const CHAT_TIMEOUT_MS = 120_000
/** 模型列表请求的超时时间（毫秒） */
const MODELS_TIMEOUT_MS = 30_000

export class IframeLLMService {
	private readonly cfg: IframeLLMConfig
	private token: ModelGatewayToken | null = null
	/** 防止并发 token 请求 */
	private tokenPromise: Promise<ModelGatewayToken> | null = null
	/** 活跃的 stream abort controllers：requestId → AbortController */
	private activeStreams = new Map<string, AbortController>()

	constructor(cfg: IframeLLMConfig) {
		this.cfg = cfg
	}

	/**
	 * 主路由入口，由 useIframeLLM → IsolatedHTMLRenderer 的 handleMessage 调用。
	 * 返回 true 表示消息已被处理。
	 */
	async handleMessage(type: string, payload: unknown): Promise<boolean> {
		switch (type) {
			case LLM_MESSAGE_TYPES.GET_MODELS_REQUEST:
				await this.handleGetModels(payload as LLMGetModelsRequest)
				return true
			case LLM_MESSAGE_TYPES.CHAT_REQUEST:
				await this.handleChat(payload as LLMChatRequest)
				return true
			case LLM_MESSAGE_TYPES.STREAM_REQUEST:
				this.handleStream(payload as LLMStreamRequest)
				return true
			case LLM_MESSAGE_TYPES.STREAM_ABORT:
				this.handleAbort(payload as LLMStreamAbort)
				return true
			default:
				return false
		}
	}

	destroy() {
		// 终止所有活跃的 stream
		this.activeStreams.forEach((controller) => {
			controller.abort()
		})
		this.activeStreams.clear()
		this.token = null
		this.tokenPromise = null
	}

	// ─── Token 管理 ──────────────────────────────────────────────────────────

	/**
	 * 获取有效的 api_key，必要时自动签发或刷新。
	 * 并发请求共享同一个 Promise，避免重复签发。
	 */
	private async ensureToken(): Promise<ModelGatewayToken> {
		if (this.token && this.token.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
			return this.token
		}

		if (this.tokenPromise) {
			return this.tokenPromise
		}

		this.tokenPromise = this.acquireToken()
		try {
			const token = await this.tokenPromise
			this.token = token
			return token
		} finally {
			this.tokenPromise = null
		}
	}

	private async acquireToken(): Promise<ModelGatewayToken> {
		// 尝试用 refresh_token 续期
		if (this.token?.refreshToken) {
			try {
				return await this.refreshToken(this.token.refreshToken)
			} catch {
				// refresh 失败，回退到重新签发
			}
		}

		return this.createToken()
	}

	private async createToken(): Promise<ModelGatewayToken> {
		const res = await fetch(`${this.cfg.baseUrl}/api/v1/model-gateway/tokens`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				authorization: this.cfg.getAuthorization(),
				"organization-code": this.cfg.getOrganizationCode(),
			},
		})

		if (!res.ok) {
			throw new Error(`Failed to create model gateway token: HTTP ${res.status}`)
		}

		const json = await res.json()
		return this.parseTokenResponse(json)
	}

	private async refreshToken(refreshToken: string): Promise<ModelGatewayToken> {
		const res = await fetch(`${this.cfg.baseUrl}/api/v1/model-gateway/tokens`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				authorization: this.cfg.getAuthorization(),
				"organization-code": this.cfg.getOrganizationCode(),
			},
			body: JSON.stringify({ refresh_token: refreshToken }),
		})

		if (!res.ok) {
			throw new Error(`Failed to refresh model gateway token: HTTP ${res.status}`)
		}

		const json = await res.json()
		return this.parseTokenResponse(json)
	}

	private parseTokenResponse(json: Record<string, unknown>): ModelGatewayToken {
		const data = (json.data ?? json) as Record<string, unknown>
		const apiKey = data.api_key as string
		const refreshToken = data.refresh_token as string
		const expiresIn = (data.expires_in as number) || 3600

		if (!apiKey) {
			throw new Error("Model gateway token response missing api_key")
		}

		return {
			apiKey,
			refreshToken: refreshToken || "",
			expiresAt: Date.now() + expiresIn * 1000,
		}
	}

	/**
	 * 执行带 token 的请求，遇到 401 时自动重试一次（先清空 token 再重新获取）。
	 */
	private async fetchWithToken(
		url: string,
		init: RequestInit,
		signal?: AbortSignal,
	): Promise<Response> {
		const token = await this.ensureToken()
		const headers = new Headers(init.headers)
		headers.set("api-key", token.apiKey)

		const res = await fetch(url, { ...init, headers, signal })

		if (res.status === 401) {
			// token 过期，清空并重试
			this.token = null
			const newToken = await this.ensureToken()
			const retryHeaders = new Headers(init.headers)
			retryHeaders.set("api-key", newToken.apiKey)
			return fetch(url, { ...init, headers: retryHeaders, signal })
		}

		return res
	}

	// ─── 消息处理 ────────────────────────────────────────────────────────────

	private async handleGetModels(req: LLMGetModelsRequest) {
		const { requestId } = req

		try {
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), MODELS_TIMEOUT_MS)

			const res = await this.fetchWithToken(
				`${this.cfg.baseUrl}/v1/models`,
				{ method: "GET", headers: { "Content-Type": "application/json" } },
				controller.signal,
			)

			clearTimeout(timer)

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
			}

			const json = await res.json()
			const models = (json.data ?? json) as Array<{
				id: string
				object?: string
				owned_by?: string
			}>

			this.send({
				type: LLM_MESSAGE_TYPES.GET_MODELS_RESPONSE,
				requestId,
				success: true,
				models: Array.isArray(models)
					? models.map((m) => ({ id: m.id, object: m.object, owned_by: m.owned_by }))
					: [],
			})
		} catch (err) {
			this.send({
				type: LLM_MESSAGE_TYPES.GET_MODELS_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Failed to get models",
			})
		}
	}

	private async handleChat(req: LLMChatRequest) {
		const { requestId, messages, options } = req

		try {
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

			const body = this.buildChatBody(messages, options, false)
			const res = await this.fetchWithToken(
				`${this.cfg.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
				controller.signal,
			)

			clearTimeout(timer)

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
			}

			const json = await res.json()
			const choice = json.choices?.[0]
			const content = choice?.message?.content ?? ""
			const model = json.model as string | undefined
			const usage = this.parseUsage(json.usage)

			this.send({
				type: LLM_MESSAGE_TYPES.CHAT_RESPONSE,
				requestId,
				success: true,
				content,
				model,
				usage,
			})
		} catch (err) {
			this.send({
				type: LLM_MESSAGE_TYPES.CHAT_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Chat request failed",
			})
		}
	}

	private async handleStream(req: LLMStreamRequest) {
		const { requestId, messages, options } = req

		const controller = new AbortController()
		this.activeStreams.set(requestId, controller)

		try {
			const body = this.buildChatBody(messages, options, true)
			const res = await this.fetchWithToken(
				`${this.cfg.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "text/event-stream",
					},
					body: JSON.stringify(body),
				},
				controller.signal,
			)

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
			}

			if (!res.body) {
				throw new Error("Response body is not readable")
			}

			await this.processSSEStream(requestId, res.body, controller.signal)
		} catch (err) {
			if ((err as Error).name === "AbortError") {
				// 用户主动取消，不需要发送错误
				return
			}
			this.send({
				type: LLM_MESSAGE_TYPES.STREAM_ERROR,
				requestId,
				error: err instanceof Error ? err.message : "Stream request failed",
			})
		} finally {
			this.activeStreams.delete(requestId)
		}
	}

	private handleAbort(req: LLMStreamAbort) {
		const controller = this.activeStreams.get(req.requestId)
		if (controller) {
			controller.abort()
			this.activeStreams.delete(req.requestId)
		}
	}

	// ─── SSE 解析 ────────────────────────────────────────────────────────────

	private async processSSEStream(
		requestId: string,
		body: ReadableStream<Uint8Array>,
		signal: AbortSignal,
	) {
		const reader = body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""

		try {
			while (!signal.aborted) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split("\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					const trimmed = line.trim()
					if (!trimmed || trimmed.startsWith(":")) continue

					if (trimmed.startsWith("data: ")) {
						const data = trimmed.slice(6).trim()

						if (data === "[DONE]") {
							this.send({
								type: LLM_MESSAGE_TYPES.STREAM_CHUNK,
								requestId,
								delta: "",
								done: true,
							})
							return
						}

						try {
							const parsed = JSON.parse(data)
							const choice = parsed.choices?.[0]
							const delta = choice?.delta?.content ?? ""
							const finishReason = choice?.finish_reason
							const isDone = finishReason === "stop"
							const usage = isDone ? this.parseUsage(parsed.usage) : undefined

							if (delta || isDone) {
								this.send({
									type: LLM_MESSAGE_TYPES.STREAM_CHUNK,
									requestId,
									delta,
									done: isDone,
									usage,
								})
							}

							if (isDone) return
						} catch {
							// 跳过无法解析的 SSE data 行
						}
					}
				}
			}
		} finally {
			reader.releaseLock()
		}
	}

	// ─── 工具方法 ────────────────────────────────────────────────────────────

	private buildChatBody(
		messages: LLMMessage[],
		options: LLMOptions | undefined,
		stream: boolean,
	) {
		const chatMessages = [...messages]

		// 如果有 systemPrompt，添加为 system 消息
		if (options?.systemPrompt) {
			chatMessages.unshift({ role: "system", content: options.systemPrompt })
		}

		return {
			model: options?.model,
			messages: chatMessages,
			temperature: options?.temperature,
			max_tokens: options?.maxTokens,
			stream,
		}
	}

	private parseUsage(
		raw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null,
	): LLMUsage | undefined {
		if (!raw) return undefined
		return {
			promptTokens: raw.prompt_tokens ?? 0,
			completionTokens: raw.completion_tokens ?? 0,
			totalTokens: raw.total_tokens ?? 0,
		}
	}

	private send(message: object) {
		this.cfg.postToIframe(message)
	}
}
