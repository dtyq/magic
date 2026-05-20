import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicI18nApi } from "../MagicI18nApi"

describe("MagicI18nApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>
	let api: MagicI18nApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		delete (window as any).__MAGIC_INITIAL_LANG__
		postMessageSpy = vi.spyOn(window.parent, "postMessage")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		api = new MagicI18nApi()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		;(window as any).Magic = undefined
		delete (window as any).__MAGIC_INITIAL_LANG__
	})

	// ─── 初始化 ────────────────────────────────────────────────────────────────

	it("install() 在 window.Magic 上注册 i18n 对象", () => {
		api.install()
		expect((window as any).Magic?.i18n).toBeDefined()
	})

	it("初始 lang 使用 window.__MAGIC_INITIAL_LANG__", () => {
		;(window as any).__MAGIC_INITIAL_LANG__ = "en-US"
		api.install()
		expect((window as any).Magic.i18n.lang).toBe("en-US")
	})

	it("未设置 __MAGIC_INITIAL_LANG__ 时 lang 兜底为 zh-CN", () => {
		api.install()
		expect((window as any).Magic.i18n.lang).toBe("zh-CN")
	})

	it("install() 幂等：多次调用不重复注册", () => {
		api.install()
		const firstI18n = (window as any).Magic.i18n
		api.install()
		expect((window as any).Magic.i18n).toBe(firstI18n)
	})

	// ─── subscribe ─────────────────────────────────────────────────────────────

	it("subscribe() 发送 MAGIC_I18N_LANG_SUBSCRIBE 到 parent", () => {
		api.install()
		const cb = vi.fn()
		;(window as any).Magic.i18n.subscribe(cb)
		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [message, origin] = postMessageSpy.mock.calls[0]
		expect(message.type).toBe("MAGIC_I18N_LANG_SUBSCRIBE")
		expect(origin).toBe("*")
	})

	it("subscribe() 返回取消订阅函数", () => {
		api.install()
		const cb = vi.fn()
		const unsubscribe = (window as any).Magic.i18n.subscribe(cb)
		expect(typeof unsubscribe).toBe("function")
	})

	it("subscribe() 传入非函数时调用 console.error 且不发送 postMessage", () => {
		api.install()
		;(window as any).Magic.i18n.subscribe("not-a-function")
		expect(consoleErrorSpy).toHaveBeenCalledOnce()
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	// ─── 消息推送更新 lang ──────────────────────────────────────────────────────

	it("收到 success:true 的 MAGIC_I18N_LANG_SUBSCRIBE 消息时更新 lang", () => {
		api.install()
		const cb = vi.fn()
		;(window as any).Magic.i18n.subscribe(cb)

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_I18N_LANG_SUBSCRIBE",
					success: true,
					results: { lang: "en-US" },
				},
				source: window.parent,
			}),
		)

		expect((window as any).Magic.i18n.lang).toBe("en-US")
	})

	it("收到 success:true 的消息时调用所有已注册的订阅回调", () => {
		api.install()
		const cb1 = vi.fn()
		const cb2 = vi.fn()
		;(window as any).Magic.i18n.subscribe(cb1)
		;(window as any).Magic.i18n.subscribe(cb2)

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_I18N_LANG_SUBSCRIBE",
					success: true,
					results: { lang: "en-US" },
				},
				source: window.parent,
			}),
		)

		expect(cb1).toHaveBeenCalledOnce()
		expect(cb1.mock.calls[0][0]).toMatchObject({ lang: "en-US" })
		expect(cb2).toHaveBeenCalledOnce()
	})

	it("收到 success:false 的消息时不触发订阅回调", () => {
		api.install()
		const cb = vi.fn()
		;(window as any).Magic.i18n.subscribe(cb)

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_I18N_LANG_SUBSCRIBE",
					success: false,
					results: { lang: "en-US" },
				},
				source: window.parent,
			}),
		)

		expect(cb).not.toHaveBeenCalled()
		expect((window as any).Magic.i18n.lang).toBe("zh-CN")
	})

	it("收到其他 type 的消息时不触发订阅回调", () => {
		api.install()
		const cb = vi.fn()
		;(window as any).Magic.i18n.subscribe(cb)

		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "OTHER_MESSAGE", success: true, results: { lang: "en-US" } },
				source: window.parent,
			}),
		)

		expect(cb).not.toHaveBeenCalled()
	})

	// ─── 取消订阅 ───────────────────────────────────────────────────────────────

	it("调用 subscribe 返回的取消函数后，不再接收后续推送", () => {
		api.install()
		const cb = vi.fn()
		const unsubscribe = (window as any).Magic.i18n.subscribe(cb)
		unsubscribe()

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_I18N_LANG_SUBSCRIBE",
					success: true,
					results: { lang: "en-US" },
				},
				source: window.parent,
			}),
		)

		expect(cb).not.toHaveBeenCalled()
	})

	it("unsubscribe() 方法移除指定回调", () => {
		api.install()
		const cb = vi.fn()
		;(window as any).Magic.i18n.subscribe(cb)
		;(window as any).Magic.i18n.unsubscribe(cb)

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_I18N_LANG_SUBSCRIBE",
					success: true,
					results: { lang: "en-US" },
				},
				source: window.parent,
			}),
		)

		expect(cb).not.toHaveBeenCalled()
	})

	it("unsubscribe() 传入非函数时静默返回（不报错）", () => {
		api.install()
		expect(() => {
			;(window as any).Magic.i18n.unsubscribe("not-a-function")
		}).not.toThrow()
	})
})
