import { describe, expect, it, vi } from "vitest"

vi.mock("../nested-iframe-content", () => ({ getNestedIframeInterceptorScript: () => "" }))
vi.mock("virtual:magic-api", () => ({ default: "" }))
vi.mock("@/models/config", () => ({
	configStore: { cluster: { clusterCode: "" }, i18n: { language: "en_US" } },
}))

import { createRuntime } from "./html-navigation.test-helpers"

describe("HTML navigation intent", () => {
	it.each([
		["", {}, "click", "_self", false],
		[' target="report"', {}, "click", "report", false],
		[' target="_blank"', {}, "click", "_blank", false],
		["", { ctrlKey: true }, "click", "_blank", true],
		["", { metaKey: true }, "click", "_blank", true],
		["", { button: 1 }, "auxclick", "_blank", true],
		["", { ctrlKey: true, shiftKey: true }, "click", "_blank", false],
		["", { shiftKey: true }, "click", "_blank", false],
	] as const)(
		"forwards link target %s with modifiers %j",
		(attributes, options, type, target, background) => {
			const runtime = createRuntime()
			const event = runtime.click(
				`<a href="detail.html"${attributes}>Open</a>`,
				options,
				type,
			)
			expect(event.defaultPrevented).toBe(true)
			expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					href: "/pages/detail.html",
					target,
					background,
					history: "push",
				}),
				"*",
			)
		},
	)

	it("respects base target while an explicit link target takes precedence", () => {
		const runtime = createRuntime()
		runtime.doc.head.innerHTML = '<base target="report">'
		runtime.click('<a href="detail.html">Open</a>')
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({ target: "report" })
		runtime.click('<a href="detail.html" target="_self">Open</a>')
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({ target: "_self" })
	})

	it("keeps download and alternate gestures native", () => {
		const runtime = createRuntime()
		expect(runtime.click('<a href="detail.html" download>Download</a>').defaultPrevented).toBe(
			false,
		)
		expect(
			runtime.click('<a href="detail.html">Open</a>', { altKey: true }).defaultPrevented,
		).toBe(false)
		expect(
			runtime.click('<a href="detail.html">Open</a>', { button: 2 }, "auxclick")
				.defaultPrevented,
		).toBe(false)
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it("honors preventDefault and preserves native hash routing", () => {
		const runtime = createRuntime()
		const prevent = MouseEvent.prototype.preventDefault
		const mock = vi.spyOn(MouseEvent.prototype, "defaultPrevented", "get").mockReturnValue(true)
		runtime.click('<a href="detail.html">Open</a>')
		expect(runtime.postMessage).not.toHaveBeenCalled()
		mock.mockRestore()
		runtime.click('<a href="#/route">Route</a>')
		expect(runtime.frame.location.hash).toBe("#/route")
		expect(runtime.postMessage).not.toHaveBeenCalled()
		expect(MouseEvent.prototype.preventDefault).toBe(prevent)
		runtime.click('<a href="#summary" target="report">Open</a>')
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({
			target: "report",
			href: "/pages/index.html#summary",
		})
	})

	it.each(["", "_self", "_parent", "_top", "report", "_blank"])(
		"opens external links outside the preview regardless of target %s",
		(target) => {
			const runtime = createRuntime()
			const event = runtime.click(
				`<a href="https://outside.test" target="${target}">Outside</a>`,
			)
			expect(event.defaultPrevented).toBe(true)
			expect(runtime.nativeOpen).toHaveBeenCalledWith(
				"https://outside.test",
				"_blank",
				"noopener,noreferrer",
			)
			expect(runtime.postMessage).not.toHaveBeenCalled()
		},
	)

	it("keeps window.open targets including its _blank default", () => {
		const runtime = createRuntime()
		runtime.run("window.open('detail.html')")
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({
			target: "_blank",
			background: false,
		})
		runtime.run("window.open('detail.html', 'report')")
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({ target: "report" })
		runtime.postMessage.mockClear()
		runtime.run("window.open('#/route', '_self')")
		expect(runtime.frame.location.hash).toBe("#/route")
		expect(runtime.postMessage).not.toHaveBeenCalled()
		runtime.frame.location.search = "?q=current"
		runtime.run("window.open('#summary')")
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({
			href: "/pages/index.html?q=current#summary",
			target: "_blank",
		})
	})

	it.each([
		{ destination: { sameDocument: true } },
		{ hashChange: true },
		{ navigationType: "traverse" },
		{ downloadRequest: "file.html" },
		{ formData: new FormData() },
		{ sourceElement: { tagName: "FORM" } },
		{ sourceElement: { tagName: "INPUT", form: {} } },
		{ defaultPrevented: true },
		{ cancelable: false },
	])("leaves same-document, cancelled or native navigation alone: %j", (options) => {
		const runtime = createRuntime(true)
		const handler = runtime.navigation.addEventListener.mock.calls[0][1]
		const event = {
			destination: { url: "https://preview.test/route" },
			preventDefault: vi.fn(),
			...options,
		}
		handler(event)
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it("forwards Navigation API replace intent and keeps hash calls native", () => {
		const runtime = createRuntime(true)
		runtime.run("window.navigation.navigate('detail.html', { history: 'replace' })")
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({ history: "replace" })
		runtime.postMessage.mockClear()
		runtime.run("window.navigation.navigate('#/route')")
		expect(runtime.postMessage).not.toHaveBeenCalled()
		// The runtime captures the native method before replacing it.
		expect(runtime.nativeNavigation).toHaveBeenCalledWith("#/route", undefined)
	})

	it("routes GET forms with successful fields and submitter target/action overrides", () => {
		const runtime = createRuntime()
		const event = runtime.submit(
			`<form action="old.html" target="old"><input name="q" value="hello world"><input name="skip" value="no" disabled><button name="submit" value="yes" formaction="detail.html?old=1#result" formtarget="report">Go</button></form>`,
		)
		expect(event.defaultPrevented).toBe(true)
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({
			href: "/pages/detail.html?q=hello+world&submit=yes#result",
			target: "report",
			history: "push",
		})
	})

	it("routes GET forms to the current file by default and honors base target", () => {
		const runtime = createRuntime()
		runtime.doc.head.innerHTML = '<base target="report">'
		runtime.submit('<form><input name="q" value="value"><button>Go</button></form>')
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({
			href: "/pages/index.html?q=value",
			target: "report",
		})
	})

	it.each([
		'<form action="detail.html" method="post"><button>Go</button></form>',
		'<form action="detail.html" method="dialog"><button>Go</button></form>',
		'<form action="detail.html"><button formmethod="post">Go</button></form>',
		'<form action="https://outside.test"><button>Go</button></form>',
	])("keeps POST/dialog/external forms native: %s", (markup) => {
		const runtime = createRuntime()
		expect(runtime.submit(markup).defaultPrevented).toBe(false)
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it("honors preventDefault and explicit GET submitter overrides", () => {
		const runtime = createRuntime()
		runtime.submit('<form action="detail.html"><button>Go</button></form>', true)
		expect(runtime.postMessage).not.toHaveBeenCalled()
		runtime.submit(
			'<form action="detail.html" method="post"><button formmethod="get">Go</button></form>',
		)
		expect(runtime.postMessage.mock.lastCall?.[0]).toMatchObject({ href: "/pages/detail.html" })
	})
})
