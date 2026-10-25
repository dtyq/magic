/**
 * AiLLMService
 *
 * 公共 LLM 调用服务，为各业务模块提供统一的大模型对话能力。
 * 基于 model-gateway token 体系，支持 chat 补全与流式输出。
 *
 * 单例模式，token 在实例内缓存并自动刷新，
 * authorization / organization-code 从 userStore 读取。
 */

import { userStore } from "@/models/user"
import { env } from "@/utils/env"

// ─── 类型 ────────────────────────────────────────────────────────────────────

export interface LLMMessage {
	role: "user" | "assistant" | "system"
	content: string
}

export interface LLMChatOptions {
	model?: string
	temperature?: number
	maxTokens?: number
	systemPrompt?: string
	/** AbortSignal for caller-side cancellation */
	signal?: AbortSignal
}

export interface LLMUsage {
	promptTokens: number
	completionTokens: number
	totalTokens: number
}

export interface LLMChatResult {
	content: string
	model?: string
	usage?: LLMUsage
}

export type StreamChunkHandler = (delta: string, done: boolean, usage?: LLMUsage) => void

// ─── 内部 Token 类型 ─────────────────────────────────────────────────────────

interface ModelGatewayToken {
	apiKey: string
	refreshToken: string
	/** 过期时间戳（毫秒） */
	expiresAt: number
}

/** token 过期前提前刷新的缓冲时间（毫秒） */
const TOKEN_REFRESH_BUFFER_MS = 60_000
/** 聊天请求的超时时间（毫秒） */
const CHAT_TIMEOUT_MS = 120_000

// ─── 服务实现 ────────────────────────────────────────────────────────────────

class AiLLMService {
	private token: ModelGatewayToken | null = null
	private tokenPromise: Promise<ModelGatewayToken> | null = null
	private defaultModel: string | undefined = undefined

	private get baseUrl(): string {
		return (env("MAGIC_SERVICE_BASE_URL") as string) || ""
	}

	private get authorization(): string {
		return userStore.user.authorization || ""
	}

	private get organizationCode(): string {
		return userStore.user.organizationCode || ""
	}

	// ─── 公开 API ────────────────────────────────────────────────────────────

	/**
	 * 设置默认模型 ID。
	 */
	setDefaultModel(modelId: string | undefined) {
		this.defaultModel = modelId
	}

	/**
	 * 非流式 chat 补全，返回完整响应内容。
	 */
	async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResult> {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

		if (options?.signal) {
			options.signal.addEventListener("abort", () => controller.abort())
		}

		try {
			const body = this.buildChatBody(messages, options, false)
			const res = await this.fetchWithToken(
				`${this.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
				controller.signal,
			)

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
			}

			const json = await res.json()
			const choice = json.choices?.[0]
			const content = choice?.message?.content ?? ""
			const model = json.model as string | undefined
			const usage = this.parseUsage(json.usage)

			return { content, model, usage }
		} finally {
			clearTimeout(timer)
		}
	}

	/**
	 * 简便方法：单条 user 消息补全，返回文本内容。
	 */
	async complete(prompt: string, options?: LLMChatOptions): Promise<string> {
		const messages: LLMMessage[] = [{ role: "user", content: prompt }]
		const result = await this.chat(messages, options)
		return result.content
	}

	/**
	 * 流式 chat 补全，通过 onChunk 回调逐片返回。
	 * 返回 abort 函数，可用于取消流。
	 */
	stream(
		messages: LLMMessage[],
		onChunk: StreamChunkHandler,
		options?: LLMChatOptions,
	): { abort: () => void } {
		const controller = new AbortController()

		if (options?.signal) {
			options.signal.addEventListener("abort", () => controller.abort())
		}

		this.runStream(messages, onChunk, controller, options).catch((err) => {
			if ((err as Error).name !== "AbortError") {
				onChunk("", true)
			}
		})

		return { abort: () => controller.abort() }
	}

	/**
	 * 清空 token 缓存（例如登出时调用）。
	 */
	clearToken() {
		this.token = null
		this.tokenPromise = null
	}

	// ─── Token 管理 ──────────────────────────────────────────────────────────

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
		if (this.token?.refreshToken) {
			try {
				return await this.refreshTokenRequest(this.token.refreshToken)
			} catch {
				// refresh 失败，回退到重新签发
			}
		}
		return this.createToken()
	}

	private async createToken(): Promise<ModelGatewayToken> {
		const res = await fetch(`${this.baseUrl}/api/v1/model-gateway/tokens`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				authorization: this.authorization,
				"organization-code": this.organizationCode,
			},
		})

		if (!res.ok) {
			throw new Error(`Failed to create model gateway token: HTTP ${res.status}`)
		}

		const json = await res.json()
		return this.parseTokenResponse(json)
	}

	private async refreshTokenRequest(refreshToken: string): Promise<ModelGatewayToken> {
		const res = await fetch(`${this.baseUrl}/api/v1/model-gateway/tokens`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				authorization: this.authorization,
				"organization-code": this.organizationCode,
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

	// ─── 请求基础设施 ────────────────────────────────────────────────────────

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
			this.token = null
			const newToken = await this.ensureToken()
			const retryHeaders = new Headers(init.headers)
			retryHeaders.set("api-key", newToken.apiKey)
			return fetch(url, { ...init, headers: retryHeaders, signal })
		}

		return res
	}

	// ─── 流式处理 ────────────────────────────────────────────────────────────

	private async runStream(
		messages: LLMMessage[],
		onChunk: StreamChunkHandler,
		controller: AbortController,
		options?: LLMChatOptions,
	) {
		const body = this.buildChatBody(messages, options, true)
		const res = await this.fetchWithToken(
			`${this.baseUrl}/v1/chat/completions`,
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

		const reader = res.body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""

		try {
			while (!controller.signal.aborted) {
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
							onChunk("", true)
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
								onChunk(delta, isDone, usage)
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
		options: LLMChatOptions | undefined,
		stream: boolean,
	) {
		const chatMessages = [...messages]

		if (options?.systemPrompt) {
			chatMessages.unshift({ role: "system", content: options.systemPrompt })
		}

		return {
			model: options?.model ?? this.defaultModel,
			messages: chatMessages,
			temperature: options?.temperature,
			max_tokens: options?.maxTokens,
			// Omit when false so the gateway applies its own default.
			stream: stream || undefined,
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
}

/** 单例实例 */
export const aiLLMService = new AiLLMService()
