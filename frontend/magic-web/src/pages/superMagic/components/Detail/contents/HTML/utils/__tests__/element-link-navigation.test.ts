import { describe, expect, it, vi } from "vitest"

vi.mock("../nested-iframe-content", () => ({ getNestedIframeInterceptorScript: () => "" }))
vi.mock("virtual:magic-api", () => ({ default: "" }))
vi.mock("@/models/config", () => ({
	configStore: { cluster: { clusterCode: "" }, i18n: { language: "en_US" } },
}))

import { createRuntime } from "./html-navigation.test-helpers"
import { getLinkHandlingScript } from "../full-content"
import { findPPTSlideIndex } from "../../../../components/PPTRender/utils/slideNavigation"

describe("element click links", () => {
	it.each(["https://outside.test", "//outside.test"])(
		"opens custom external link %s outside the preview",
		(href) => {
			const runtime = createRuntime()
			const event = runtime.click(`<div data-magic-href="${href}" target="_self">Go</div>`)
			expect(event.defaultPrevented).toBe(true)
			expect(runtime.nativeOpen).toHaveBeenCalledWith(href, "_blank", "noopener,noreferrer")
			expect(runtime.nativeNavigate).not.toHaveBeenCalled()
			expect(runtime.postMessage).not.toHaveBeenCalled()
		},
	)

	it("does not open external anchors while editing", () => {
		const runtime = createRuntime()
		Object.assign(runtime.frame, { slideSelector: { isEditMode: true } })
		const event = runtime.click('<a href="https://outside.test">Go</a>')
		expect(event.defaultPrevented).toBe(true)
		expect(runtime.nativeOpen).not.toHaveBeenCalled()
	})

	it.each(["div", "img", "button"])(
		"routes %s links through the existing navigation runtime",
		(tag) => {
			const runtime = createRuntime()
			const event = runtime.click(`<${tag} data-magic-href='detail.html'>Go</${tag}>`)
			expect(event.defaultPrevented).toBe(true)
			expect(runtime.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					href: "/pages/detail.html",
					originalHref: "detail.html",
				}),
				"*",
			)
		},
	)

	it("finds the configured ancestor when a child is clicked", () => {
		const runtime = createRuntime()
		runtime.click(
			'<div data-magic-href="detail.html"><span>Go</span></div>',
			{},
			"click",
			"span",
		)
		expect(runtime.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ href: "/pages/detail.html" }),
			"*",
		)
	})

	it("keeps custom element clicks in the editor while editing", () => {
		const runtime = createRuntime()
		Object.assign(runtime.frame, { slideSelector: { isEditMode: true } })
		runtime.click('<div data-magic-href="detail.html">Go</div>')
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it.each([
		"javascript:alert(1)",
		"java&#10;script:alert(1)",
		"data:text/html,hi",
		"file:///secret",
	])("rejects executable custom link %s", (href) => {
		const runtime = createRuntime()
		runtime.click(`<div data-magic-href="${href}">Go</div>`)
		expect(runtime.postMessage).not.toHaveBeenCalled()
		expect(runtime.nativeNavigate).not.toHaveBeenCalled()
	})

	it.each(["a", "div"])(
		"resolves an actual %s click to the target PPT page after runtime normalization",
		(tag) => {
			const runtime = createRuntime()
			runtime.run(getLinkHandlingScript("slides/cover.html"))
			runtime.click(
				`<${tag} ${tag === "a" ? "href" : "data-magic-href"}="summary.html">Go</${tag}>`,
			)
			const message = runtime.postMessage.mock.calls[0][0]
			expect(
				findPPTSlideIndex(
					[{ path: "slides/cover.html" }, { path: "slides/summary.html" }],
					"slides/cover.html",
					message.href,
				),
			).toBe(1)
		},
	)
})
