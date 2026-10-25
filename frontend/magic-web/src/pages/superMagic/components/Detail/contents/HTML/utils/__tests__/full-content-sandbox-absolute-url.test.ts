import { JSDOM } from "jsdom"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../nested-iframe-content", () => ({ getNestedIframeInterceptorScript: () => "" }))
vi.mock("virtual:magic-api", () => ({ default: "" }))
vi.mock("@/models/config", () => ({ configStore: { i18n: { language: "en_US" } } }))
vi.mock("@/pages/superMagic/utils/api", () => ({ getTemporaryDownloadUrl: vi.fn() }))
vi.mock("@/utils/env", () => ({ env: () => "https://cdn.example.test" }))
vi.mock("../index", () => ({
	rewriteHtmlCdnWithHost: (html: string) => new DOMParser().parseFromString(html, "text/html"),
}))

import { getFullContent } from "../full-content"
import { POST_MESSAGE_TARGET_STRATEGIES } from "../fetchInterceptor"

const SANDBOX_ORIGIN = "https://sandbox.example.test"

describe("sandbox same-origin absolute resource URLs", () => {
	let dom: JSDOM | undefined
	afterEach(() => {
		dom?.window.close()
		vi.restoreAllMocks()
	})

	async function setup(strategy: string) {
		dom = new JSDOM(
			getFullContent("<html><head></head><body></body></html>", "absolute-fixture", {
				postMessageTargetStrategy:
					strategy as (typeof POST_MESSAGE_TARGET_STRATEGIES)[keyof typeof POST_MESSAGE_TARGET_STRATEGIES],
			}),
			{
				// The render-site shell keeps the share page query (including the password) on its URL.
				url: `${SANDBOX_ORIGIN}/?password=secret`,
				runScripts: "outside-only",
			},
		)
		const { window } = dom
		const requests: string[] = []
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message.type !== "MAGIC_FETCH_URL_REQUEST") return
			requests.push(message.relativePath)
			window.queueMicrotask(() =>
				window.dispatchEvent(
					new window.MessageEvent("message", {
						data: {
							type: "MAGIC_FETCH_URL_RESPONSE",
							requestId: message.requestId,
							success: true,
							url: "https://assets.example.test/" + message.relativePath,
							expires_at: "2099-01-01 00:00:00",
						},
					}),
				),
			)
		})
		window.eval(window.document.querySelector('script[data-injected="true"]')!.textContent!)
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		return { window, requests }
	}

	it("resolves an absolute sandbox URL as a workspace-relative path", async () => {
		const { window, requests } = await setup(POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT)
		const img = window.document.createElement("img")
		// Mirrors Playwright's `new URL(path, location.href)` + copied page query.
		img.src = `${SANDBOX_ORIGIN}/data/%E6%88%AA%E5%9B%BE.png?password=secret`
		window.document.body.appendChild(img)

		await vi.waitFor(() =>
			expect(img.src).toBe("https://assets.example.test/data/%E6%88%AA%E5%9B%BE.png"),
		)
		expect(requests).toEqual(["data/截图.png"])
		expect(requests.join("")).not.toContain("secret")
	})

	it("keeps query params that the page itself did not copy", async () => {
		const { window, requests } = await setup(POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT)
		const img = window.document.createElement("img")
		window.document.body.appendChild(img)
		img.setAttribute("src", `${SANDBOX_ORIGIN}/data/a.png?password=secret&v=2`)

		await vi.waitFor(() => expect(requests).toEqual(["data/a.png?v=2"]))
	})

	it("leaves absolute URLs to other origins untouched", async () => {
		const { window, requests } = await setup(POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT)
		const img = window.document.createElement("img")
		window.document.body.appendChild(img)
		img.setAttribute("src", "https://public.example.test/a.png")
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

		expect(requests).toEqual([])
		expect(img.getAttribute("src")).toBe("https://public.example.test/a.png")
	})

	it("does not treat same-origin absolute URLs as workspace files outside render-site mode", async () => {
		const { window, requests } = await setup(
			POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
		)
		const img = window.document.createElement("img")
		window.document.body.appendChild(img)
		img.setAttribute("src", `${SANDBOX_ORIGIN}/data/a.png`)
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

		expect(requests).toEqual([])
	})
})
