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

describe("dynamic style text resource resolution", () => {
	let dom: JSDOM | undefined
	afterEach(() => {
		// Every fixture owns its native prototypes, observers, listeners and timers.
		dom?.window.close()
		vi.restoreAllMocks()
	})

	async function setup(deferResponses = false) {
		dom = new JSDOM(
			getFullContent("<html><head></head><body></body></html>", "style-fixture"),
			{
				url: "https://iframe.example.test/",
				runScripts: "outside-only",
			},
		)
		const { window } = dom
		const requests: string[] = []
		const responses: Array<() => void> = []
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message.type !== "MAGIC_FETCH_URL_REQUEST") return
			requests.push(message.relativePath)
			const respond = () =>
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
				)
			responses.push(respond)
			if (!deferResponses) window.queueMicrotask(respond)
		})
		window.eval(window.document.querySelector('script[data-injected="true"]')!.textContent!)
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		const style = window.document.createElement("style")
		window.document.head.appendChild(style)
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		return { window, style, requests, responses }
	}

	it("resolves textContent assigned after an empty style has been connected", async () => {
		const { window, style, requests } = await setup()
		let mutationCount = 0
		const observer = new window.MutationObserver(() => {
			mutationCount += 1
		})
		observer.observe(style, { childList: true, characterData: true, subtree: true })
		style.textContent = '.hero{background-image:url("images/hero.svg")}'
		await vi.waitFor(() =>
			expect(style.textContent).toContain("https://assets.example.test/images/hero.svg"),
		)
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		expect(requests).toEqual(["images/hero.svg"])
		expect(mutationCount).toBe(2)
		observer.disconnect()
	})

	it("resolves changes to an existing style Text.data node", async () => {
		const { window, style, requests } = await setup()
		style.textContent = ".hero{color:red}"
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		const text = style.firstChild as Text
		text.data = '.hero{background-image:url("images/updated.svg")}'
		await vi.waitFor(() =>
			expect(style.textContent).toContain("https://assets.example.test/images/updated.svg"),
		)
		expect(requests).toEqual(["images/updated.svg"])
	})

	it("does not parse ordinary text nodes or repeatedly rewrite absolute CSS URLs", async () => {
		const { window, style, requests } = await setup()
		style.textContent = '.hero{background-image:url("https://public.example.test/hero.svg")}'
		window.document.body.appendChild(window.document.createTextNode("url(images/not-css.svg)"))
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		expect(requests).toEqual([])
		expect(style.textContent).toBe(
			'.hero{background-image:url("https://public.example.test/hero.svg")}',
		)
	})

	it("resolves newly appended rules alongside already rewritten CSS", async () => {
		const { window, style, requests } = await setup()
		style.textContent = '.hero{background-image:url("images/first.svg")}'
		await vi.waitFor(() =>
			expect(style.textContent).toContain("https://assets.example.test/images/first.svg"),
		)
		;(style.firstChild as Text).appendData('.new{background-image:url("images/second.svg")}')
		await vi.waitFor(() =>
			expect(style.textContent).toContain("https://assets.example.test/images/second.svg"),
		)
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		expect(style.textContent).toContain("https://assets.example.test/images/first.svg")
		expect(requests).toEqual(["images/first.svg", "images/second.svg"])
		expect(style.textContent?.match(/__ORIGINAL_URL__/g)).toHaveLength(2)
	})

	it("does not let a late resolution overwrite newer style text", async () => {
		const { window, style, requests, responses } = await setup(true)
		style.textContent = '.old{background-image:url("images/old.svg")}'
		await vi.waitFor(() => expect(requests).toEqual(["images/old.svg"]))
		style.textContent = '.new{background-image:url("images/new.svg")}'
		await vi.waitFor(() => expect(requests).toHaveLength(2))
		responses[1]()
		await vi.waitFor(() =>
			expect(style.textContent).toContain("https://assets.example.test/images/new.svg"),
		)
		const newestText = style.textContent
		responses[0]()
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		expect(style.textContent).toBe(newestText)
		expect(requests).toHaveLength(2)
	})
})
