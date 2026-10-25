import { JSDOM } from "jsdom"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../nested-iframe-content", () => ({ getNestedIframeInterceptorScript: () => "" }))
vi.mock("virtual:magic-api", () => ({ default: "" }))
const language = vi.hoisted(() => ({ language: "en_US", displayLanguage: "zh_CN" }))
vi.mock("@/models/config", () => ({ configStore: { i18n: language } }))
vi.mock("@/pages/superMagic/utils/api", () => ({ getTemporaryDownloadUrl: vi.fn() }))
vi.mock("@/utils/env", () => ({ env: () => "https://cdn.example.test" }))
vi.mock("../index", () => ({
	rewriteHtmlCdnWithHost: (html: string) => new DOMParser().parseFromString(html, "text/html"),
}))

import { getFullContent } from "../full-content"
import { createEphemeralVirtualStorageContext } from "../virtual-storage"

describe("full content storage installation order", () => {
	let dom: JSDOM | undefined
	afterEach(() => dom?.window.close())

	function inject(markerId: string, explicitContext = false, crossOrigin = false) {
		const html = getFullContent("<html><head></head><body></body></html>", markerId, {
			serviceWorkerMockMode: "off",
			postMessageTargetStrategy: crossOrigin ? "cross-origin-parent" : "same-origin-ancestor",
			...(explicitContext
				? { virtualStorage: createEphemeralVirtualStorageContext(markerId) }
				: {}),
		})
		const parsed = new DOMParser().parseFromString(html, "text/html")
		const script = parsed.querySelector('script[data-injected="true"]')?.textContent
		if (!script || !dom) throw new Error("Missing fixture script or window")
		dom.window.eval(script)
	}

	it("boots with the effective display language, including session overrides", () => {
		dom = new JSDOM("", { url: "https://sandbox.example/", runScripts: "outside-only" })
		const html = getFullContent("<html><body></body></html>", "language")
		const parsed = new DOMParser().parseFromString(html, "text/html")
		const script = parsed.querySelector('script[data-injected="magic-lang"]')?.textContent
		if (!script) throw Error("Missing language bootstrap")
		dom.window.eval(script)
		expect(Reflect.get(dom.window, "__MAGIC_INITIAL_LANG__")).toBe("zh_CN")
	})

	it("uses native marker backing once and preserves both areas across A → B → A reinjection", () => {
		dom = new JSDOM("", { url: "https://standalone.example/", runScripts: "outside-only" })
		const frame = dom.window
		const nativeLocal = frame.localStorage
		const nativeSession = frame.sessionStorage
		nativeLocal.setItem("host-secret", "hidden")
		inject("a")
		frame.localStorage.setItem("draft", "saved-a")
		frame.sessionStorage.setItem("tab", "session-a")
		expect(nativeLocal.getItem("MAGIC:iframe:storage:a")).toBe('{"draft":"saved-a"}')
		expect(nativeSession.getItem("MAGIC:iframe:storage:a")).toBe('{"tab":"session-a"}')
		expect(frame.localStorage.getItem("host-secret")).toBeNull()
		inject("b")
		expect(frame.localStorage.getItem("draft")).toBeNull()
		expect(frame.sessionStorage.getItem("tab")).toBeNull()
		frame.localStorage.setItem("draft", "saved-b")
		inject("a")
		expect(frame.localStorage.getItem("draft")).toBe("saved-a")
		expect(frame.sessionStorage.getItem("tab")).toBe("session-a")
		expect(nativeLocal.getItem("MAGIC:iframe:storage:b")).toBe('{"draft":"saved-b"}')
		expect(nativeLocal.getItem("host-secret")).toBe("hidden")
	})

	it("explicit host context installs only virtual storage and never writes marker buckets", () => {
		dom = new JSDOM("", { url: "https://host-context.example/", runScripts: "outside-only" })
		const frame = dom.window
		const nativeLocal = frame.localStorage
		inject("context", true)
		frame.localStorage.setItem("draft", "virtual")
		expect(frame.localStorage.getItem("draft")).toBe("virtual")
		expect(nativeLocal.length).toBe(0)
		expect(Reflect.has(frame, "__MAGIC_LEGACY_STORAGE_FACTORY__")).toBe(false)
	})

	it("dynamic resource defaults preserve the configured cross-origin storage target", () => {
		dom = new JSDOM("", { url: "https://sandbox.example/", runScripts: "outside-only" })
		inject("cross-origin", true, true)
		expect(Reflect.get(dom.window, "__MAGIC_POST_MESSAGE_TARGET_STRATEGY__")).toBe(
			"cross-origin-parent",
		)
	})
})
