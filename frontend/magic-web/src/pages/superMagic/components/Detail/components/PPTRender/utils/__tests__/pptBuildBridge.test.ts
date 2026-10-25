import { afterEach, describe, expect, it, vi } from "vitest"
import { injectPPTBuildBridge, setPPTBuildFrame } from "../pptBuildBridge"

afterEach(() => {
	vi.useRealTimers()
	document.body.innerHTML = ""
})
describe("PPT build bridge", () => {
	it("runs the serialized runtime without bundler closure dependencies and reveals complete groups", () => {
		vi.useFakeTimers()
		const html = `<html><head></head><body><h1>Title</h1><p data-ppt-step="9" data-ppt-effect="appear">A</p><p data-ppt-step="9" data-ppt-effect="appear">B</p></body></html>`
		const result = injectPPTBuildBridge(html, window.location.origin, "doc", true)
		const parsed = new DOMParser().parseFromString(result, "text/html")
		document.body.innerHTML = parsed.body.innerHTML
		const script = parsed.querySelector("script")!.textContent!
		expect(() => new Function(script)()).not.toThrow()
		expect(document.querySelectorAll("[data-magic-ppt-build-hidden]")).toHaveLength(2)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: window.parent,
				origin: window.location.origin,
				data: {
					type: "ppt-build:set",
					documentKey: "doc",
					requestId: "one",
					enabled: true,
					step: 1,
				},
			}),
		)
		expect(document.querySelectorAll("[data-magic-ppt-build-hidden]")).toHaveLength(0)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: window.parent,
				origin: "https://invalid.example",
				data: {
					type: "ppt-build:set",
					documentKey: "doc",
					requestId: "two",
					enabled: true,
					step: 0,
				},
			}),
		)
		expect(document.querySelectorAll("[data-magic-ppt-build-hidden]")).toHaveLength(0)
		window.dispatchEvent(new Event("pagehide"))
	})
	it("reveals a nested child only after both its own and its parent's step", () => {
		const html = `<html><head></head><body><section id="parent" data-ppt-step="2"><p id="child" data-ppt-step="1">C</p><p id="plain">P</p></section></body></html>`
		const result = injectPPTBuildBridge(html, window.location.origin, "nested", true)
		const parsed = new DOMParser().parseFromString(result, "text/html")
		document.body.innerHTML = parsed.body.innerHTML
		new Function(parsed.querySelector("script")!.textContent!)()
		const hidden = () =>
			[...document.querySelectorAll("[data-magic-ppt-build-hidden]")].map((e) => e.id)
		const go = (step: number) =>
			window.dispatchEvent(
				new MessageEvent("message", {
					source: window.parent,
					origin: window.location.origin,
					data: {
						type: "ppt-build:set",
						documentKey: "nested",
						requestId: `r${step}`,
						enabled: true,
						step,
					},
				}),
			)
		expect(hidden().sort()).toEqual(["child", "parent"])
		go(1)
		// The child's own step is reached, but its hidden parent still covers it.
		expect(hidden().sort()).toEqual(["parent"])
		go(2)
		expect(hidden()).toEqual([])
		window.dispatchEvent(new Event("pagehide"))
	})
	it("reports per-step automatic delays to the host", () => {
		vi.useRealTimers()
		const html = `<html><head></head><body><p data-ppt-step="1">A</p><p data-ppt-step="2" data-ppt-after="400">B</p><p data-ppt-step="2" data-ppt-after="900">C</p></body></html>`
		const result = injectPPTBuildBridge(html, window.location.origin, "auto", true)
		const parsed = new DOMParser().parseFromString(result, "text/html")
		document.body.innerHTML = parsed.body.innerHTML
		new Function(parsed.querySelector("script")!.textContent!)()
		const applied: unknown[] = []
		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === "ppt-build:applied") applied.push(event.data)
		}
		window.addEventListener("message", onMessage)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: window.parent,
				origin: window.location.origin,
				data: {
					type: "ppt-build:set",
					documentKey: "auto",
					requestId: "r",
					enabled: true,
					step: 0,
				},
			}),
		)
		return new Promise<void>((resolve) =>
			setTimeout(() => {
				window.removeEventListener("message", onMessage)
				window.dispatchEvent(new Event("pagehide"))
				expect(applied).toContainEqual(
					expect.objectContaining({ delays: [null, 900], total: 2, documentKey: "auto" }),
				)
				resolve()
			}, 20),
		)
	})
	it("fails open if the host does not acknowledge initialization", () => {
		vi.useFakeTimers()
		const html = `<p data-ppt-step="1" data-ppt-effect="appear">First</p>`
		const parsed = new DOMParser().parseFromString(
			injectPPTBuildBridge(html, window.location.origin, "fallback", true),
			"text/html",
		)
		document.body.innerHTML = parsed.body.innerHTML
		new Function(parsed.querySelector("script")!.textContent!)()
		expect(document.querySelector("[data-magic-ppt-build-hidden]")).not.toBeNull()
		vi.advanceTimersByTime(1000)
		expect(document.querySelector("[data-magic-ppt-build-hidden]")).toBeNull()
		window.dispatchEvent(new Event("pagehide"))
	})
	it("preserves links and buttons while advancing a plain content click", () => {
		vi.useFakeTimers()
		const html = `<p id="plain" data-ppt-step="1" data-ppt-effect="appear">First</p><a href="#target" id="link">link</a><button id="button">control</button>`
		const parsed = new DOMParser().parseFromString(
			injectPPTBuildBridge(html, window.location.origin, "click", true),
			"text/html",
		)
		document.body.innerHTML = parsed.body.innerHTML
		const post = vi.spyOn(window.parent, "postMessage")
		new Function(parsed.querySelector("script")!.textContent!)()
		document
			.getElementById("link")!
			.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
		document
			.getElementById("button")!
			.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
		expect(post).not.toHaveBeenCalled()
		document
			.getElementById("plain")!
			.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
		expect(post).toHaveBeenCalledWith(
			{ type: "ppt-build:action", direction: "next", documentKey: "click" },
			window.location.origin,
		)
		post.mockRestore()
		window.dispatchEvent(new Event("pagehide"))
	})
	it("does not change static pages or authored content", () => {
		const html = "<p>Static</p>"
		expect(injectPPTBuildBridge(html, "https://example.org", "d", true)).toBe(html)
	})
	it("requires the exact frame, origin, request and document for acknowledgements", async () => {
		vi.useFakeTimers()
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const post = vi.spyOn(iframe.contentWindow!, "postMessage")
		const promise = setPPTBuildFrame(iframe, "d", true, 1)
		const command = post.mock.calls[0][0] as { requestId: string }
		const data = {
			type: "ppt-build:applied",
			requestId: command.requestId,
			documentKey: "d",
			step: 1,
			total: 2,
		}
		window.dispatchEvent(
			new MessageEvent("message", { source: window, origin: window.location.origin, data }),
		)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: iframe.contentWindow,
				origin: "https://wrong.example",
				data,
			}),
		)
		let done = false
		void promise.then(() => {
			done = true
		})
		await Promise.resolve()
		expect(done).toBe(false)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: iframe.contentWindow,
				origin: window.location.origin,
				data,
			}),
		)
		expect(await promise).toEqual({ step: 1, total: 2 })
	})
})
