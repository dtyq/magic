import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MagicFSApi } from "../MagicFSApi"
import { MagicLLMApi } from "../MagicLLMApi"
import { MagicI18nApi } from "../MagicI18nApi"
import { markPreludeVersion } from "../prelude-runtime-context"
import { createMagicApiHarness, dispatchHostMessage } from "./magic-api-test-helpers"

describe("Magic API subscription isolation and cleanup", () => {
	let host: ReturnType<typeof createMagicApiHarness>
	let fs: NonNullable<Window["Magic"]["fs"]>
	let llm: NonNullable<Window["Magic"]["llm"]>
	let i18n: NonNullable<Window["Magic"]["i18n"]>
	beforeEach(() => {
		host = createMagicApiHarness()
		vi.useFakeTimers()
		markPreludeVersion(1)
		window.__MAGIC_API_PRELUDE_VERSION__ = 1
		for (const Plugin of [MagicFSApi, MagicLLMApi, MagicI18nApi]) new Plugin().install()
		if (!window.Magic.fs || !window.Magic.llm || !window.Magic.i18n) {
			throw new Error("Expected all subscription plugins to install")
		}
		fs = window.Magic.fs
		llm = window.Magic.llm
		i18n = window.Magic.i18n
	})
	afterEach(() => {
		delete window.__MAGIC_API_PRELUDE_VERSION__
		host.cleanup()
	})

	it.each(["done", "error", "cancel"])(
		"stream releases its listener on %s and ignores later chunks",
		(ending) => {
			const callback = vi.fn()
			const baseline = host.pendingListeners().length
			const cancel = llm.stream([], callback)
			const { requestId } = host.latestRequest()
			if (ending === "cancel") {
				cancel()
				cancel()
				expect(
					host.postMessage.mock.calls.filter(
						([message]) => message.type === "MAGIC_LLM_STREAM_ABORT",
					),
				).toHaveLength(1)
			} else {
				dispatchHostMessage({
					type: ending === "done" ? "MAGIC_LLM_STREAM_CHUNK" : "MAGIC_LLM_STREAM_ERROR",
					requestId,
					delta: "last",
					done: true,
				})
				expect(callback).toHaveBeenCalledWith(ending === "done" ? "last" : "", true)
			}
			expect(host.pendingListeners()).toHaveLength(baseline)
			callback.mockClear()
			dispatchHostMessage({
				type: "MAGIC_LLM_STREAM_CHUNK",
				requestId,
				delta: "late",
				done: false,
			})
			expect(callback).not.toHaveBeenCalled()
		},
	)

	it("keeps concurrent streams independent when one callback throws or is cancelled", () => {
		const broken = vi.fn(() => {
			throw new Error("consumer failed")
		})
		const healthy = vi.fn()
		const cancelFirst = llm.stream([], broken)
		const first = host.latestRequest().requestId
		const cancelSecond = llm.stream([], healthy)
		const second = host.latestRequest().requestId
		dispatchHostMessage({ type: "MAGIC_LLM_STREAM_CHUNK", requestId: first, delta: "a" })
		expect(broken).toHaveBeenCalledOnce()
		expect(healthy).not.toHaveBeenCalled()
		cancelFirst()
		dispatchHostMessage({ type: "MAGIC_LLM_STREAM_CHUNK", requestId: second, delta: "b" })
		expect(healthy).toHaveBeenCalledWith("b", false)
		cancelSecond()
		expect(host.pendingListeners()).toHaveLength(1)
	})

	it.each(["watchFile", "watchDir"] as const)(
		"%s ignores old-document events and can still be explicitly cleaned up",
		(method) => {
			const callback = vi.fn()
			const cancel = fs[method]("./watched", callback)
			window.__MAGIC_API_PRELUDE_VERSION__ = 2
			dispatchHostMessage({
				type: method === "watchFile" ? "MAGIC_FS_FILE_CHANGED" : "MAGIC_FS_DIR_CHANGED",
				path: "./watched",
				dir: "./watched",
				timestamp: 10,
			})
			expect(callback).not.toHaveBeenCalled()
			cancel()
			expect(host.pendingListeners()).toHaveLength(1)
			expect(host.latestRequest().type).toBe(
				method === "watchFile"
					? "MAGIC_FS_WATCH_UNREGISTER"
					: "MAGIC_FS_WATCH_DIR_UNREGISTER",
			)
		},
	)

	it("watchers for the same path can unsubscribe independently and isolate callback exceptions", () => {
		const broken = vi.fn(() => {
			throw new Error("consumer failed")
		})
		const healthy = vi.fn()
		const first = fs.watchFile("./a", broken)
		const second = fs.watchFile("./a", healthy)
		dispatchHostMessage({ type: "MAGIC_FS_FILE_CHANGED", path: "./a", timestamp: 10 })
		expect(broken).toHaveBeenCalledOnce()
		expect(healthy).toHaveBeenCalledWith({ path: "./a", timestamp: 10 })
		first()
		dispatchHostMessage({ type: "MAGIC_FS_FILE_CHANGED", path: "./a", timestamp: 11 })
		expect(broken).toHaveBeenCalledOnce()
		expect(healthy).toHaveBeenCalledTimes(2)
		second()
		expect(host.pendingListeners()).toHaveLength(1)
	})

	it("i18n isolates failing subscribers and ignores old-document pushes", () => {
		const broken = vi.fn(() => {
			throw new Error("consumer failed")
		})
		const healthy = vi.fn()
		const removeBroken = i18n.subscribe(broken)
		const removeHealthy = i18n.subscribe(healthy)
		dispatchHostMessage({
			type: "MAGIC_I18N_LANG_SUBSCRIBE",
			success: true,
			results: { lang: "en-US" },
		})
		expect(healthy).toHaveBeenCalledWith({ lang: "en-US" })
		expect(i18n.lang).toBe("en-US")
		window.__MAGIC_API_PRELUDE_VERSION__ = 2
		dispatchHostMessage({
			type: "MAGIC_I18N_LANG_SUBSCRIBE",
			success: true,
			results: { lang: "zh-CN" },
		})
		expect(healthy).toHaveBeenCalledOnce()
		expect(i18n.lang).toBe("en-US")
		removeBroken()
		removeHealthy()
	})
})
