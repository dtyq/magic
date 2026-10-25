// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import {
	normalizeSandboxHtml,
	requiresNativeLoadWait,
} from "../src/sandbox/htmlRenderSandbox.helpers"
import {
	detectRenderReadinessCapabilities,
	waitForPageRenderReadiness,
} from "../src/sandbox/render-readiness"

describe("export animation normalization", () => {
	it("freezes animations at their final frame instead of leaving opacity at the initial value", () => {
		const normalized = normalizeSandboxHtml(
			"<html><head></head><body><div class='a'>visible</div></body></html>",
		)

		expect(normalized).toContain('setAttribute("data-magic-export-mode","pptx")')
		expect(normalized).toContain('magic:export-start')
		expect(normalized).not.toContain("animation:none")
		expect(normalized).toContain("animation-play-state:paused!important")
		expect(normalized).toContain("animation-delay:-999999s!important")
		expect(normalized).toContain("animation-iteration-count:1!important")
		expect(normalized).toContain("animation-fill-mode:both!important")
	})
})

describe("page export readiness protocol", () => {
	it("detects the explicit export-ready marker and setter", () => {
		expect(
			detectRenderReadinessCapabilities(`
				<html><body data-magic-export-ready="pending">
					<script>
						document.body.dataset.magicExportReady = "true"
					</script>
				</html>
			`),
		).toEqual({
			echartsSourceHint: false,
			expectsExplicitRenderReady: true,
		})
	})

	it("waits for the page-owned export-ready marker", async () => {
		document.documentElement.setAttribute("data-magic-export-ready", "pending")
		const originalRequestAnimationFrame = window.requestAnimationFrame
		window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
			callback(0)
			return 0
		}) as typeof window.requestAnimationFrame

		try {
			const readiness = waitForPageRenderReadiness({
				iframeWindow: window,
				iframeDocument: document,
				echartsSourceHint: false,
				expectsExplicitRenderReady: true,
				explicitReadyTimeoutMs: 100,
			})
			window.setTimeout(() => {
				document.documentElement.setAttribute("data-magic-export-ready", "true")
			}, 0)

			expect(await readiness).toEqual({ handledCanvas: false })
		} finally {
			document.documentElement.removeAttribute("data-magic-export-ready")
			window.requestAnimationFrame = originalRequestAnimationFrame
		}
	})

	it("waits for a body-owned export-ready marker", async () => {
		document.body.setAttribute("data-magic-export-ready", "pending")
		const originalRequestAnimationFrame = window.requestAnimationFrame
		window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
			callback(0)
			return 0
		}) as typeof window.requestAnimationFrame

		try {
			const readiness = waitForPageRenderReadiness({
				iframeWindow: window,
				iframeDocument: document,
				echartsSourceHint: false,
				expectsExplicitRenderReady: true,
				explicitReadyTimeoutMs: 100,
			})
			window.setTimeout(() => {
				document.body.setAttribute("data-magic-export-ready", "true")
			}, 0)

			expect(await readiness).toEqual({ handledCanvas: false })
		} finally {
			document.body.removeAttribute("data-magic-export-ready")
			window.requestAnimationFrame = originalRequestAnimationFrame
		}
	})
})

describe("native-load readiness classification", () => {
	it("does not add a fixed grace period to static HTML", () => {
		expect(
			requiresNativeLoadWait(
				"<!doctype html><html><head><style>.title{font-size:20px}</style></head><body><div class=title>text</div></body></html>",
			),
		).toBe(false)
	})

	it("keeps the grace period for executable or asynchronous pages", () => {
		expect(requiresNativeLoadWait("<html><body><script>draw()</script></body></html>")).toBe(
			true,
		)
		expect(
			requiresNativeLoadWait(
				'<html><head><link rel="stylesheet" href="theme.css"></head><body></body></html>',
			),
		).toBe(true)
		expect(requiresNativeLoadWait("<html><body><canvas></canvas></body></html>")).toBe(true)
		expect(requiresNativeLoadWait('<html data-render-ready="true"><body></body></html>')).toBe(
			true,
		)
		expect(requiresNativeLoadWait('<html><body onpageshow="hydrate()"></body></html>')).toBe(
			true,
		)
		expect(requiresNativeLoadWait('<html><body><img onabort="retry()"></body></html>')).toBe(
			true,
		)
		expect(
			requiresNativeLoadWait(
				'<html><body><svg><image href="https://assets.example.test/chart.png"></image></svg></body></html>',
			),
		).toBe(true)
		expect(
			requiresNativeLoadWait(
				'<html><body><svg><use xlink:href="https://assets.example.test/icons.svg#check"></use></svg></body></html>',
			),
		).toBe(true)
	})

	it("allows resource-specific image readiness to replace the fixed delay", () => {
		expect(requiresNativeLoadWait('<html><body><img src="image.png"></body></html>')).toBe(
			false,
		)
	})
})
