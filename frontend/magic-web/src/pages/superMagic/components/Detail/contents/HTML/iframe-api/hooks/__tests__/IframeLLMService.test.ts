import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { IframeLLMService, type IframeLLMConfig } from "../../services/IframeLLMService"

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function createService(overrides?: Partial<IframeLLMConfig>) {
	const postToIframe = vi.fn()
	const cfg: IframeLLMConfig = {
		postToIframe,
		baseUrl: "https://api.example.com",
		getAuthorization: () => "Bearer test-token",
		getOrganizationCode: () => "org-123",
		...overrides,
	}
	const service = new IframeLLMService(cfg)
	return { service, postToIframe, cfg }
}

function mockFetchSuccess(body: unknown, status = 200) {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
		body: null,
	})
}

function mockTokenResponse(apiKey = "test-api-key", expiresIn = 3600) {
	return {
		code: 1000,
		data: {
			api_key: apiKey,
			refresh_token: "test-refresh-token",
			expires_in: expiresIn,
		},
	}
}

// ─── 测试 ────────────────────────────────────────────────────────────────────

describe("IframeLLMService", () => {
	let originalFetch: typeof globalThis.fetch

	beforeEach(() => {
		originalFetch = globalThis.fetch
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	// ─── handleMessage 路由 ──────────────────────────────────────────────────

	describe("handleMessage routing", () => {
		it("处理 MAGIC_LLM_GET_MODELS_REQUEST 并返回 true", async () => {
			const { service } = createService()
			globalThis.fetch = mockFetchSuccess(mockTokenResponse())

			// 第二次 fetch 返回 models
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							data: [{ id: "gpt-4", object: "model", owned_by: "openai" }],
						}),
					text: () => Promise.resolve(""),
				})
			globalThis.fetch = fetchMock

			const handled = await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-1",
			})
			expect(handled).toBe(true)
		})

		it("处理 MAGIC_LLM_CHAT_REQUEST 并返回 true", async () => {
			const { service } = createService()
			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							choices: [{ message: { content: "Hello!" } }],
							model: "gpt-4",
						}),
					text: () => Promise.resolve(""),
				})

			const handled = await service.handleMessage("MAGIC_LLM_CHAT_REQUEST", {
				type: "MAGIC_LLM_CHAT_REQUEST",
				requestId: "req-2",
				messages: [{ role: "user", content: "Hi" }],
			})
			expect(handled).toBe(true)
		})

		it("处理 MAGIC_LLM_STREAM_ABORT 并返回 true", async () => {
			const { service } = createService()
			const handled = await service.handleMessage("MAGIC_LLM_STREAM_ABORT", {
				type: "MAGIC_LLM_STREAM_ABORT",
				requestId: "req-3",
			})
			expect(handled).toBe(true)
		})

		it("对未知消息类型返回 false", async () => {
			const { service } = createService()
			const handled = await service.handleMessage("UNKNOWN_TYPE", {})
			expect(handled).toBe(false)
		})
	})

	// ─── Token 管理 ──────────────────────────────────────────────────────────

	describe("token management", () => {
		it("首次请求时自动创建 token", async () => {
			const { service, postToIframe } = createService()
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse("key-1")),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ data: [] }),
					text: () => Promise.resolve(""),
				})
			globalThis.fetch = fetchMock

			await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-token-1",
			})

			// 第一次 fetch 是 token 创建
			const tokenCall = fetchMock.mock.calls[0]
			expect(tokenCall[0]).toBe("https://api.example.com/api/v1/model-gateway/tokens")
			expect(tokenCall[1].method).toBe("POST")

			// 第二次 fetch 是 models 请求，使用了 api-key
			const modelsCall = fetchMock.mock.calls[1]
			expect(modelsCall[0]).toBe("https://api.example.com/v1/models")
			const headers = modelsCall[1].headers as Headers
			expect(headers.get("api-key")).toBe("key-1")
		})

		it("token 有效时复用，不重复签发", async () => {
			const { service } = createService()
			let tokenCallCount = 0
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes("model-gateway/tokens")) {
					tokenCallCount++
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve(mockTokenResponse("key-reuse", 3600)),
						text: () => Promise.resolve(""),
					})
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ data: [] }),
					text: () => Promise.resolve(""),
				})
			})

			await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-reuse-1",
			})
			await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-reuse-2",
			})

			expect(tokenCallCount).toBe(1)
		})

		it("token 创建失败时响应错误", async () => {
			const { service, postToIframe } = createService()
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.resolve({}),
				text: () => Promise.resolve("Internal Server Error"),
			})

			await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-fail",
			})

			expect(postToIframe).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_LLM_GET_MODELS_RESPONSE",
					requestId: "req-fail",
					success: false,
					error: expect.stringContaining("500"),
				}),
			)
		})

		it("401 时重试 token 获取", async () => {
			const { service, postToIframe } = createService()
			let callIndex = 0
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				callIndex++
				if (url.includes("model-gateway/tokens")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve(
								mockTokenResponse(callIndex <= 1 ? "old-key" : "new-key"),
							),
						text: () => Promise.resolve(""),
					})
				}
				// 第一次 models 请求返回 401
				if (callIndex === 2) {
					return Promise.resolve({
						ok: false,
						status: 401,
						json: () => Promise.resolve({}),
						text: () => Promise.resolve("Unauthorized"),
					})
				}
				// 重试后成功
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ data: [{ id: "gpt-4", object: "model" }] }),
					text: () => Promise.resolve(""),
				})
			})

			await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-401",
			})

			expect(postToIframe).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_LLM_GET_MODELS_RESPONSE",
					requestId: "req-401",
					success: true,
				}),
			)
		})
	})

	// ─── getModels ───────────────────────────────────────────────────────────

	describe("getModels", () => {
		it("成功返回模型列表", async () => {
			const { service, postToIframe } = createService()
			const models = [
				{ id: "gpt-4", object: "model", owned_by: "openai" },
				{ id: "claude-3", object: "model", owned_by: "anthropic" },
			]
			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ data: models }),
					text: () => Promise.resolve(""),
				})

			await service.handleMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				type: "MAGIC_LLM_GET_MODELS_REQUEST",
				requestId: "req-models",
			})

			expect(postToIframe).toHaveBeenCalledWith({
				type: "MAGIC_LLM_GET_MODELS_RESPONSE",
				requestId: "req-models",
				success: true,
				models,
			})
		})
	})

	// ─── chat ────────────────────────────────────────────────────────────────

	describe("chat", () => {
		it("成功返回聊天内容和 usage", async () => {
			const { service, postToIframe } = createService()
			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							choices: [{ message: { content: "Hello, world!" } }],
							model: "gpt-4",
							usage: {
								prompt_tokens: 10,
								completion_tokens: 5,
								total_tokens: 15,
							},
						}),
					text: () => Promise.resolve(""),
				})

			await service.handleMessage("MAGIC_LLM_CHAT_REQUEST", {
				type: "MAGIC_LLM_CHAT_REQUEST",
				requestId: "req-chat",
				messages: [{ role: "user", content: "Hi" }],
				options: { model: "gpt-4" },
			})

			expect(postToIframe).toHaveBeenCalledWith({
				type: "MAGIC_LLM_CHAT_RESPONSE",
				requestId: "req-chat",
				success: true,
				content: "Hello, world!",
				model: "gpt-4",
				usage: {
					promptTokens: 10,
					completionTokens: 5,
					totalTokens: 15,
				},
			})
		})

		it("chat 失败时返回错误", async () => {
			const { service, postToIframe } = createService()
			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					json: () => Promise.resolve({}),
					text: () => Promise.resolve("Server Error"),
				})

			await service.handleMessage("MAGIC_LLM_CHAT_REQUEST", {
				type: "MAGIC_LLM_CHAT_REQUEST",
				requestId: "req-chat-fail",
				messages: [{ role: "user", content: "Hi" }],
			})

			expect(postToIframe).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_LLM_CHAT_RESPONSE",
					requestId: "req-chat-fail",
					success: false,
					error: expect.stringContaining("500"),
				}),
			)
		})

		it("systemPrompt 作为 system 消息注入", async () => {
			const { service } = createService()
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							choices: [{ message: { content: "OK" } }],
						}),
					text: () => Promise.resolve(""),
				})
			globalThis.fetch = fetchMock

			await service.handleMessage("MAGIC_LLM_CHAT_REQUEST", {
				type: "MAGIC_LLM_CHAT_REQUEST",
				requestId: "req-sys",
				messages: [{ role: "user", content: "Hi" }],
				options: { systemPrompt: "You are a helpful assistant." },
			})

			const chatCall = fetchMock.mock.calls[1]
			const body = JSON.parse(chatCall[1].body)
			expect(body.messages[0]).toEqual({
				role: "system",
				content: "You are a helpful assistant.",
			})
			expect(body.messages[1]).toEqual({ role: "user", content: "Hi" })
		})
	})

	// ─── stream abort ────────────────────────────────────────────────────────

	describe("stream abort", () => {
		it("abort 终止活跃的 stream", async () => {
			const { service } = createService()
			const abortSpy = vi.fn()

			// Mock stream request that hangs
			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockTokenResponse()),
					text: () => Promise.resolve(""),
				})
				.mockImplementationOnce(
					(_url: string, init?: RequestInit) =>
						new Promise((_resolve, reject) => {
							init?.signal?.addEventListener("abort", () => {
								abortSpy()
								reject(new DOMException("Aborted", "AbortError"))
							})
						}),
				)

			// Start stream (don't await, it will hang)
			const streamPromise = service.handleMessage("MAGIC_LLM_STREAM_REQUEST", {
				type: "MAGIC_LLM_STREAM_REQUEST",
				requestId: "req-stream-abort",
				messages: [{ role: "user", content: "Hi" }],
			})

			// Give the stream time to start
			await new Promise((r) => setTimeout(r, 10))

			// Abort
			await service.handleMessage("MAGIC_LLM_STREAM_ABORT", {
				type: "MAGIC_LLM_STREAM_ABORT",
				requestId: "req-stream-abort",
			})

			await streamPromise
			expect(abortSpy).toHaveBeenCalled()
		})
	})

	// ─── destroy ─────────────────────────────────────────────────────────────

	describe("destroy", () => {
		it("清理所有活跃 stream 和 token", () => {
			const { service } = createService()
			// Just verify destroy doesn't throw
			service.destroy()
			service.destroy() // 幂等
		})
	})
})
