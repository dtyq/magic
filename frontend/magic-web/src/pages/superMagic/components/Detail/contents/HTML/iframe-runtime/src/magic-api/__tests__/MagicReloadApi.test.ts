import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicReloadApi } from "../MagicReloadApi"

describe("MagicReloadApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicReloadApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		api = new MagicReloadApi()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		;(window as any).Magic = undefined
	})

	it("install() 在 window.Magic 上注册 reload 函数", () => {
		api.install()
		expect(typeof (window as any).Magic?.reload).toBe("function")
	})

	it("install() 初始化 window.Magic 对象（若不存在）", () => {
		expect((window as any).Magic).toBeUndefined()
		api.install()
		expect((window as any).Magic).toBeDefined()
	})

	it("调用 window.Magic.reload() 发送 MAGIC_RELOAD_REQUEST 消息到 parent", () => {
		api.install()
		const before = Date.now()
		;(window as any).Magic.reload()
		const after = Date.now()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [message, origin] = postMessageSpy.mock.calls[0]
		expect(message.type).toBe("MAGIC_RELOAD_REQUEST")
		expect(typeof message.timestamp).toBe("number")
		expect(message.timestamp).toBeGreaterThanOrEqual(before)
		expect(message.timestamp).toBeLessThanOrEqual(after)
		expect(origin).toBe("*")
	})

	it("install() 幂等：多次调用不重复注册（reload 引用不变）", () => {
		api.install()
		const firstReload = (window as any).Magic.reload
		api.install()
		expect((window as any).Magic.reload).toBe(firstReload)
	})

	it("install() 保留 window.Magic 上已有的其他属性", () => {
		;(window as any).Magic = { existingProp: "value" }
		api.install()
		expect((window as any).Magic.existingProp).toBe("value")
		expect(typeof (window as any).Magic.reload).toBe("function")
	})
})
