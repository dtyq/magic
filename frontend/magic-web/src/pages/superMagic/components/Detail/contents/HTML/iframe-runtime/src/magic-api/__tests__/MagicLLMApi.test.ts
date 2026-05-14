import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicLLMApi } from "../MagicLLMApi"

const userMessages = [{ role: "user" as const, content: "Hello" }]

describe("MagicLLMApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicLLMApi

	function simulateMessage(data: Record<string, unknown>) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: window.parent,
			}),
		)
	}

	function findCall(type: string) {
		const call = [...postMessageSpy.mock.calls]
			.reverse()
			.find(([msg]) => (msg as Record<string, unknown>)?.type === type)
		expect(call).toBeDefined()
		return call![0] as Record<string, unknown>
	}

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		api = new MagicLLMApi()
		api.install()
	})

	afterEach(() => {
		postMessageSpy.mockRestore()
		vi.useRealTimers()
		;(window as any).Magic = undefined
	})

	// ─── install() ─────────────────────────────────────────────────────────────

	it("install() 在 window.Magic 上注册 llm 对象", () => {
		expect((window as any).Magic?.llm).toBeDefined()
		expect(typeof (window as any).Magic.llm.getModels).toBe("function")
		expect(typeof (window as any).Magic.llm.chat).toBe("function")
		expect(typeof (window as any).Magic.llm.stream).toBe("function")
	})

	it("install() 幂等：多次调用 llm 引用不变", () => {
		const firstLlm = (window as any).Magic.llm
		api.install()
		expect((window as any).Magic.llm).toBe(firstLlm)
	})

	// ─── getModels() ───────────────────────────────────────────────────────────

	it("getModels() 发送 MAGIC_LLM_GET_MODELS_REQUEST 到 parent", () => {
		;(window as any).Magic.llm.getModels()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const req = findCall("MAGIC_LLM_GET_MODELS_REQUEST")
		expect(typeof req.requestId).toBe("string")
	})

	it("getModels() 收到 success:true 响应时 resolve 模型列表", async () => {
		const models = [
			{ id: "gpt-4", object: "model", owned_by: "openai" },
			{ id: "claude-3", object: "model", owned_by: "anthropic" },
		]
		const promise = (window as any).Magic.llm.getModels()
		const req = findCall("MAGIC_LLM_GET_MODELS_REQUEST")

		simulateMessage({
			type: "MAGIC_LLM_GET_MODELS_RESPONSE",
			requestId: req.requestId,
			success: true,
			models,
		})

		await expect(promise).resolves.toEqual(models)
	})

	it("getModels() 收到 success:false 时 reject", async () => {
		const promise = (window as any).Magic.llm.getModels()
		const req = findCall("MAGIC_LLM_GET_MODELS_REQUEST")

		simulateMessage({
			type: "MAGIC_LLM_GET_MODELS_RESPONSE",
			requestId: req.requestId,
			success: false,
			error: "Unauthorized",
		})

		await expect(promise).rejects.toThrow("Unauthorized")
	})

	it("getModels() 在 30s 内无响应时 reject 超时错误", async () => {
		vi.useFakeTimers()
		const promise = (window as any).Magic.llm.getModels()

		vi.advanceTimersByTime(30_001)

		await expect(promise).rejects.toThrow("timed out")
		vi.useRealTimers()
	})

	// ─── chat() ────────────────────────────────────────────────────────────────

	it("chat() 发送 MAGIC_LLM_CHAT_REQUEST 到 parent", () => {
		;(window as any).Magic.llm.chat(userMessages)

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const req = findCall("MAGIC_LLM_CHAT_REQUEST")
		expect(req.messages).toEqual(userMessages)
		expect(typeof req.requestId).toBe("string")
	})

	it("chat() 收到 success:true 响应时 resolve 回复内容", async () => {
		const promise = (window as any).Magic.llm.chat(userMessages)
		const req = findCall("MAGIC_LLM_CHAT_REQUEST")

		simulateMessage({
			type: "MAGIC_LLM_CHAT_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: "AI response",
		})

		await expect(promise).resolves.toBe("AI response")
	})

	it("chat() 收到 success:false 响应时 reject 并携带错误信息", async () => {
		const promise = (window as any).Magic.llm.chat(userMessages)
		const req = findCall("MAGIC_LLM_CHAT_REQUEST")

		simulateMessage({
			type: "MAGIC_LLM_CHAT_RESPONSE",
			requestId: req.requestId,
			success: false,
			error: "Model overloaded",
		})

		await expect(promise).rejects.toThrow("Model overloaded")
	})

	it("chat() 忽略 requestId 不匹配的响应消息", async () => {
		const promise = (window as any).Magic.llm.chat(userMessages)
		let resolved = false
		promise.then(() => {
			resolved = true
		})

		simulateMessage({
			type: "MAGIC_LLM_CHAT_RESPONSE",
			requestId: "wrong-id",
			success: true,
			content: "ignored",
		})

		await Promise.resolve()
		expect(resolved).toBe(false)

		// cleanup
		const req = findCall("MAGIC_LLM_CHAT_REQUEST")
		simulateMessage({
			type: "MAGIC_LLM_CHAT_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: "",
		})
		await promise
	})

	it("chat() 传递 options 参数", async () => {
		const opts = { model: "gpt-4", temperature: 0.7 }
		const promise = (window as any).Magic.llm.chat(userMessages, opts)
		const req = findCall("MAGIC_LLM_CHAT_REQUEST")
		expect(req.options).toEqual(opts)

		simulateMessage({
			type: "MAGIC_LLM_CHAT_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: "",
		})
		await promise
	})

	it("chat() 在 120s 内无响应时 reject 超时错误", async () => {
		vi.useFakeTimers()
		const promise = (window as any).Magic.llm.chat(userMessages)

		vi.advanceTimersByTime(120_001)

		await expect(promise).rejects.toThrow("timed out")
		vi.useRealTimers()
	})

	// ─── stream() ──────────────────────────────────────────────────────────────

	it("stream() 发送 MAGIC_LLM_STREAM_REQUEST 到 parent", () => {
		;(window as any).Magic.llm.stream(userMessages, vi.fn())

		const req = findCall("MAGIC_LLM_STREAM_REQUEST")
		expect(req.messages).toEqual(userMessages)
		expect(typeof req.requestId).toBe("string")
	})

	it("stream() 收到 MAGIC_LLM_STREAM_CHUNK 时调用 onChunk 回调", () => {
		const onChunk = vi.fn()
		;(window as any).Magic.llm.stream(userMessages, onChunk)
		const req = findCall("MAGIC_LLM_STREAM_REQUEST")
		const requestId = req.requestId as string

		simulateMessage({ type: "MAGIC_LLM_STREAM_CHUNK", requestId, delta: "Hello", done: false })
		simulateMessage({ type: "MAGIC_LLM_STREAM_CHUNK", requestId, delta: " World", done: true })

		expect(onChunk).toHaveBeenCalledTimes(2)
		expect(onChunk.mock.calls[0]).toEqual(["Hello", false])
		expect(onChunk.mock.calls[1]).toEqual([" World", true])
	})

	it("stream() 返回取消函数，调用后不再触发 onChunk", () => {
		const onChunk = vi.fn()
		const cancel = (window as any).Magic.llm.stream(userMessages, onChunk)
		const req = findCall("MAGIC_LLM_STREAM_REQUEST")
		const requestId = req.requestId as string

		cancel()

		simulateMessage({
			type: "MAGIC_LLM_STREAM_CHUNK",
			requestId,
			delta: "after cancel",
			done: false,
		})

		expect(onChunk).not.toHaveBeenCalled()
	})

	it("stream() 忽略 requestId 不匹配的 chunk 消息", () => {
		const onChunk = vi.fn()
		;(window as any).Magic.llm.stream(userMessages, onChunk)

		simulateMessage({
			type: "MAGIC_LLM_STREAM_CHUNK",
			requestId: "wrong-id",
			delta: "ignored",
			done: false,
		})

		expect(onChunk).not.toHaveBeenCalled()
	})

	it("stream() 传递 options 参数（含 stream: true）", () => {
		const opts = { model: "claude-3" }
		;(window as any).Magic.llm.stream(userMessages, vi.fn(), opts)

		const req = findCall("MAGIC_LLM_STREAM_REQUEST")
		expect(req.options).toMatchObject(opts)
		expect((req.options as Record<string, unknown>).stream).toBe(true)
	})

	it("stream() 收到 MAGIC_LLM_STREAM_ERROR 时以 done=true 通知调用方", () => {
		const onChunk = vi.fn()
		;(window as any).Magic.llm.stream(userMessages, onChunk)
		const req = findCall("MAGIC_LLM_STREAM_REQUEST")
		const requestId = req.requestId as string

		simulateMessage({
			type: "MAGIC_LLM_STREAM_ERROR",
			requestId,
			error: "Internal error",
		})

		expect(onChunk).toHaveBeenCalledOnce()
		expect(onChunk).toHaveBeenCalledWith("", true)
	})
})
