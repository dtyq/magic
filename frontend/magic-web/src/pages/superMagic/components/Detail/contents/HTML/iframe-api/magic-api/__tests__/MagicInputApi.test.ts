import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicInputApi } from "../MagicInputApi"
import { runtimeLoggerHub, type RuntimeLogRecord } from "@dtyq/html-sandbox"

describe("MagicInputApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicInputApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		api = new MagicInputApi()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		;(window as any).Magic = undefined
	})

	it("install() 在 window.Magic 上注册 setInputMessage 函数", () => {
		api.install()
		expect(typeof (window as any).Magic?.setInputMessage).toBe("function")
	})

	it("传入合法字符串时发送 MAGIC_SET_INPUT_MESSAGE 消息到 parent", () => {
		api.install()
		const before = Date.now()
		;(window as any).Magic.setInputMessage("请分析数据")
		const after = Date.now()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [message, origin] = postMessageSpy.mock.calls[0]
		expect(message.type).toBe("MAGIC_SET_INPUT_MESSAGE")
		expect(message.message).toBe("请分析数据")
		expect(typeof message.timestamp).toBe("number")
		expect(message.timestamp).toBeGreaterThanOrEqual(before)
		expect(message.timestamp).toBeLessThanOrEqual(after)
		expect(origin).toBe(window.location.origin)
	})

	it("传入空字符串时仍然发送消息（空字符串是合法 string）", () => {
		api.install()
		;(window as any).Magic.setInputMessage("")
		expect(postMessageSpy).toHaveBeenCalledOnce()
		expect(postMessageSpy.mock.calls[0][0].message).toBe("")
	})

	function collectRuntimeLogs(): { records: RuntimeLogRecord[]; unsubscribe: () => void } {
		const records: RuntimeLogRecord[] = []
		const unsubscribe = runtimeLoggerHub.subscribe((record) => records.push(record))
		return { records, unsubscribe }
	}

	it("传入非字符串（数字）时记录 runtime error 且不发送 postMessage", () => {
		api.install()
		const { records, unsubscribe } = collectRuntimeLogs()
		;(window as any).Magic.setInputMessage(42)
		unsubscribe()
		expect(records).toContainEqual(
			expect.objectContaining({
				level: "error",
				source: "MagicInputApi",
				event: "setInputMessage:invalid-argument",
				details: { messageType: "number" },
			}),
		)
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	it("传入非字符串（null）时记录 runtime error 且不发送 postMessage", () => {
		api.install()
		const { records, unsubscribe } = collectRuntimeLogs()
		;(window as any).Magic.setInputMessage(null)
		unsubscribe()
		expect(records).toContainEqual(
			expect.objectContaining({
				level: "error",
				source: "MagicInputApi",
				event: "setInputMessage:invalid-argument",
				details: { messageType: "object" },
			}),
		)
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	it("传入非字符串（数组）时记录 runtime error 且不发送 postMessage", () => {
		api.install()
		const { records, unsubscribe } = collectRuntimeLogs()
		;(window as any).Magic.setInputMessage(["a"])
		unsubscribe()
		expect(records).toContainEqual(
			expect.objectContaining({
				level: "error",
				source: "MagicInputApi",
				event: "setInputMessage:invalid-argument",
				details: { messageType: "object" },
			}),
		)
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	it("install() 幂等：多次调用不重复注册", () => {
		api.install()
		const firstFn = (window as any).Magic.setInputMessage
		api.install()
		expect((window as any).Magic.setInputMessage).toBe(firstFn)
	})
})
