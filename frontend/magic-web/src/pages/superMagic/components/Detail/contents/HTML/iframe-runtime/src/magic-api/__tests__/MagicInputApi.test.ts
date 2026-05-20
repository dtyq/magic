import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicInputApi } from "../MagicInputApi"

describe("MagicInputApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>
	let api: MagicInputApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
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
		expect(origin).toBe("*")
	})

	it("传入空字符串时仍然发送消息（空字符串是合法 string）", () => {
		api.install()
		;(window as any).Magic.setInputMessage("")
		expect(postMessageSpy).toHaveBeenCalledOnce()
		expect(postMessageSpy.mock.calls[0][0].message).toBe("")
	})

	it("传入非字符串（数字）时调用 console.error 且不发送 postMessage", () => {
		api.install()
		;(window as any).Magic.setInputMessage(42)
		expect(consoleErrorSpy).toHaveBeenCalledOnce()
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	it("传入非字符串（null）时调用 console.error 且不发送 postMessage", () => {
		api.install()
		;(window as any).Magic.setInputMessage(null)
		expect(consoleErrorSpy).toHaveBeenCalledOnce()
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	it("传入非字符串（数组）时调用 console.error 且不发送 postMessage", () => {
		api.install()
		;(window as any).Magic.setInputMessage(["a"])
		expect(consoleErrorSpy).toHaveBeenCalledOnce()
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	it("install() 幂等：多次调用不重复注册", () => {
		api.install()
		const firstFn = (window as any).Magic.setInputMessage
		api.install()
		expect((window as any).Magic.setInputMessage).toBe(firstFn)
	})
})
