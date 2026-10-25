import { describe, expect, it, vi } from "vitest"
import { createIframeRuntimeScript } from "../../iframe-runtime/create-script"

vi.mock("../nested-iframe-content", () => ({
	getNestedIframeInterceptorScript: () => "",
}))

vi.mock("virtual:magic-api", () => ({ default: "" }))

vi.mock("@/models/config", () => ({
	configStore: {
		cluster: {
			clusterCode: "",
		},
		i18n: {
			language: "zh_CN",
		},
	},
}))

describe("decodeHTMLEntities", () => {
	it("does not decode an HTML document because a textarea contains escaped HTML", async () => {
		const { decodeHTMLEntities } = await import("../full-content")
		const script = `function escapeHtml(value) {
			return String(value).replace(/'/g, () => '&#39;');
		}`
		const html = `<!DOCTYPE html><html><head><script>${script}</script></head><body>
			<textarea>&lt;!DOCTYPE html&gt;\n&lt;html&gt;&lt;body&gt;Scene&lt;/body&gt;&lt;/html&gt;</textarea>
		</body></html>`

		expect(decodeHTMLEntities(html)).toBe(html)
	})

	it("still decodes a document whose first token is escaped HTML", async () => {
		const { decodeHTMLEntities } = await import("../full-content")
		expect(decodeHTMLEntities("&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;/html&gt;")).toBe(
			"<!DOCTYPE html><html></html>",
		)
	})
})

describe("getFullContent", () => {
	it("marks authored elements before user scripts can create runtime nodes", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			'<html><body><section id="static"><p>Fixed</p><div id="dynamic"></div></section><script>document.querySelector("#dynamic").innerHTML = "<p>Dynamic</p>"</script></body></html>',
		)
		const doc = new DOMParser().parseFromString(html, "text/html")

		expect(doc.documentElement.hasAttribute("data-magic-source-node")).toBe(true)
		expect(doc.querySelector("#static p")?.hasAttribute("data-magic-source-node")).toBe(true)
		expect(
			doc
				.querySelector('script[data-injected="true"]')
				?.hasAttribute("data-magic-source-node"),
		).toBe(false)
	})

	it("installs PPT touch zoom only when requested through compiled runtime preparation", async () => {
		const { getFullContent } = await import("../full-content")
		const html = "<!DOCTYPE html><html><body><h1>Slide</h1></body></html>"
		expect(getFullContent(html)).not.toContain("magic-preview-pinch-ready")
		const prepared = getFullContent(html, undefined, { enableTouchPinchZoom: true })
		expect(prepared).toContain("magic-preview-pinch-ready")
		const { filterInjectedTags } = await import("../index")
		expect(filterInjectedTags(prepared, new Map())).not.toContain("magic-preview-pinch")
		const doc = new DOMParser().parseFromString(prepared, "text/html")
		const script = Array.from(doc.querySelectorAll("script[data-injected]")).find((item) =>
			item.textContent?.includes("magic-preview-pinch-ready"),
		)
		expect(script).toBeDefined()
		// Execute the final HTML's rewritten/minified installer, not just its TypeScript source.
		const parent = {
			get document() {
				throw new DOMException("Cross-origin", "SecurityError")
			},
			postMessage: vi.fn(),
		}
		const sandbox = Object.assign(new EventTarget(), { parent })
		new Function("window", "document", script?.textContent || "")(sandbox, document)
		expect(parent.postMessage).toHaveBeenCalledWith(
			{ type: "magic-preview-pinch-ready" },
			window.location.origin,
		)
		;(
			sandbox as typeof sandbox & { __MAGIC_PREVIEW_PINCH_CLEANUP__: () => void }
		).__MAGIC_PREVIEW_PINCH_CLEANUP__()
	})

	it("refreshes a failed static image through its original relative path", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			'<!DOCTYPE html><html><body><img src="https://oss.example.test/expired.png" data-original-path="images/hero.png"></body></html>',
			"html-file",
			{ postMessageTargetStrategy: "same-origin-ancestor" },
		)
		document.body.innerHTML = html

		const injectedScript = document.querySelector('script[data-injected="true"]')
		expect(injectedScript?.textContent).toContain("__MAGIC_REFRESH_RESOURCE_URL__")
		const postMessage = vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message && typeof message === "object" && "type" in message) {
				queueMicrotask(() => {
					window.dispatchEvent(
						new MessageEvent("message", {
							data: {
								type: "MAGIC_FETCH_URL_RESPONSE",
								requestId: (message as { requestId: string }).requestId,
								success: true,
								url: "https://oss.example.test/refreshed.png",
								expires_at: "2099-01-01 00:00:00",
							},
						}),
					)
				})
			}
		})
		window.eval(injectedScript?.textContent || "")
		document.dispatchEvent(new Event("DOMContentLoaded"))

		const image = document.querySelector("img") as HTMLImageElement
		image.dispatchEvent(new Event("error"))
		await new Promise((resolve) => setTimeout(resolve, 0))
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_FETCH_URL_REQUEST",
				relativePath: "images/hero.png",
			}),
			"*",
		)
		expect(image.src).toBe("https://oss.example.test/refreshed.png")
	})

	it("refreshes a failed CSS background image through its original path", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			"<!DOCTYPE html><html><head><style>.hero{background-image:/*__ORIGINAL_URL__:images/hero.png__*/url('https://oss.example.test/expired.png')}</style></head><body><div class=\"hero\"></div></body></html>",
			"html-file",
		)
		document.body.innerHTML = html
		const injectedScript = document.querySelector('script[data-injected="true"]')
		const postMessage = vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message && typeof message === "object" && "type" in message) {
				queueMicrotask(() => {
					window.dispatchEvent(
						new MessageEvent("message", {
							data: {
								type: "MAGIC_FETCH_URL_RESPONSE",
								requestId: (message as { requestId: string }).requestId,
								success: true,
								url: "https://oss.example.test/refreshed.png",
								expires_at: "2099-01-01 00:00:00",
							},
						}),
					)
				})
			}
		})
		const OriginalImage = window.Image
		class FailingImage {
			onerror: (() => void) | null = null

			set src(value: string) {
				if (value.includes("expired")) queueMicrotask(() => this.onerror?.())
			}
		}
		Object.defineProperty(window, "Image", { configurable: true, value: FailingImage })
		try {
			window.eval(injectedScript?.textContent || "")
			document.dispatchEvent(new Event("DOMContentLoaded"))
			await new Promise((resolve) => setTimeout(resolve, 0))
			await new Promise((resolve) => setTimeout(resolve, 0))
		} finally {
			Object.defineProperty(window, "Image", { configurable: true, value: OriginalImage })
		}

		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_FETCH_URL_REQUEST",
				relativePath: "images/hero.png",
			}),
			"*",
		)
		expect(document.querySelector("style:not([data-injected])")?.textContent).toContain(
			"https://oss.example.test/refreshed.png",
		)
	})

	it("refreshes a failed CSS background image that uses double quotes", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			'<!DOCTYPE html><html><head><style>.hero{background-image:/*__ORIGINAL_URL__:images/hero.png__*/url("https://oss.example.test/expired.png")}</style></head><body><div class="hero"></div></body></html>',
			"html-file",
		)
		document.body.innerHTML = html
		const injectedScript = document.querySelector('script[data-injected="true"]')
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message && typeof message === "object" && "type" in message) {
				queueMicrotask(() => {
					window.dispatchEvent(
						new MessageEvent("message", {
							data: {
								type: "MAGIC_FETCH_URL_RESPONSE",
								requestId: (message as { requestId: string }).requestId,
								success: true,
								url: "https://oss.example.test/refreshed.png",
								expires_at: "2099-01-01 00:00:00",
							},
						}),
					)
				})
			}
		})
		const OriginalImage = window.Image
		class FailingImage {
			onerror: (() => void) | null = null

			set src(value: string) {
				if (value.includes("expired")) queueMicrotask(() => this.onerror?.())
			}
		}
		Object.defineProperty(window, "Image", { configurable: true, value: FailingImage })
		try {
			window.eval(injectedScript?.textContent || "")
			document.dispatchEvent(new Event("DOMContentLoaded"))
			await new Promise((resolve) => setTimeout(resolve, 0))
			await new Promise((resolve) => setTimeout(resolve, 0))
		} finally {
			Object.defineProperty(window, "Image", { configurable: true, value: OriginalImage })
		}

		expect(document.querySelector("style:not([data-injected])")?.textContent).toContain(
			"https://oss.example.test/refreshed.png",
		)
	})

	it("refreshes a failed video through its original relative path", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			'<!DOCTYPE html><html><body><video src="https://oss.example.test/expired.mp4" data-original-path="videos/hero.mp4"></video></body></html>',
			"html-file",
		)
		document.body.innerHTML = html
		const injectedScript = document.querySelector('script[data-injected="true"]')
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message && typeof message === "object" && "type" in message) {
				queueMicrotask(() => {
					window.dispatchEvent(
						new MessageEvent("message", {
							data: {
								type: "MAGIC_FETCH_URL_RESPONSE",
								requestId: (message as { requestId: string }).requestId,
								success: true,
								url: "https://oss.example.test/refreshed.mp4",
								expires_at: "2099-01-01 00:00:00",
							},
						}),
					)
				})
			}
		})
		window.eval(injectedScript?.textContent || "")
		document.dispatchEvent(new Event("DOMContentLoaded"))

		const video = document.querySelector("video") as HTMLVideoElement
		video.dispatchEvent(new Event("error"))
		await new Promise((resolve) => setTimeout(resolve, 0))
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(video.src).toBe("https://oss.example.test/refreshed.mp4")
	})

	it("falls back to hash retry when image URL refresh fails", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			'<!DOCTYPE html><html><body><img src="https://oss.example.test/expired.png" data-original-path="images/hero.png"></body></html>',
			"html-file",
		)
		document.body.innerHTML = html
		const injectedScript = document.querySelector('script[data-injected="true"]')
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message && typeof message === "object" && "type" in message) {
				queueMicrotask(() => {
					window.dispatchEvent(
						new MessageEvent("message", {
							data: {
								type: "MAGIC_FETCH_URL_RESPONSE",
								requestId: (message as { requestId: string }).requestId,
								success: false,
								error: "not found",
							},
						}),
					)
				})
			}
		})
		window.eval(injectedScript?.textContent || "")
		document.dispatchEvent(new Event("DOMContentLoaded"))

		const image = document.querySelector("img") as HTMLImageElement
		image.dispatchEvent(new Event("error"))
		await new Promise((resolve) => setTimeout(resolve, 0))
		await new Promise((resolve) => setTimeout(resolve, 0))

		const src = image.getAttribute("src") || image.src
		expect(image.getAttribute("data-url-refresh-attempted")).toBe("true")
		expect(src.includes("__magic_img_retry__") || src.startsWith("data:image/svg+xml")).toBe(
			true,
		)
	})

	it("injects HTML navigation state and forwards internal navigation messages", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><head><script>window.__USER_SEARCH__ = location.search</script></head><body><a href='./detail.html?mode=preview#summary'>Open</a></body></html>",
			"index-file",
			{
				locationSearch: "?mode=preview",
				locationAnchor: "#summary",
				navigationRequestId: "file-1:1",
			},
		)

		expect(result).toContain('data-injected="html-navigation"')
		const navigationScript =
			new DOMParser()
				.parseFromString(result, "text/html")
				.querySelector('script[data-injected="html-navigation"]')?.textContent || ""
		const target = {
			location: { pathname: "/preview" },
			history: { replaceState: vi.fn() },
			__MAGIC_HTML_NAVIGATION__: undefined,
		}
		new Function("window", navigationScript)(target)
		expect(target.__MAGIC_HTML_NAVIGATION__).toEqual({
			search: "?mode=preview",
			hash: "#summary",
			requestId: "file-1:1",
		})
		expect(target.history.replaceState).toHaveBeenCalledWith(
			null,
			"",
			"/preview?mode=preview#summary",
		)
		expect(result).not.toContain('data-injected="sandbox-html-navigation"')
		expect(result).toContain("getInternalNavigationHref: getInternalNavigationHref")
		expect(result).toContain("__magicGetFetchPostMessageTarget")
		expect(result).toContain("window.__MAGIC_HTML_NAVIGATION_RUNTIME__")
		expect(result).not.toContain("const originalWindowOpen = window.open")
		expect(result.indexOf("var nativeWindowOpen = window.open")).toBeLessThan(
			result.indexOf("window.__USER_SEARCH__"),
		)
		expect(result).toContain("destination.hash === window.location.hash")
		expect(result).toContain("isSameDocumentRewrite")
	})

	it("normalizes nested HTML links to project-root paths without forwarding file identity", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><a href='../shared.html?mode=preview'>Open</a></body></html>",
			"nested-file",
			{ navigationBasePath: "pages/detail.html" },
		)

		const linkMessageStart = result.indexOf('type: "linkClicked"')
		const linkMessageEnd = result.indexOf('}, "*");', linkMessageStart)
		const linkMessage = result.slice(linkMessageStart, linkMessageEnd)

		expect(result).toContain('var navigationBasePath = "pages/detail.html"')
		expect(linkMessage).not.toContain("fileId:")
	})

	it("injects hidden scrollbar styles without disabling vertical scrolling", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><div>Preview</div></body></html>",
			"",
			{
				hideVerticalScroll: true,
			},
		)

		expect(result).toContain("overflow-y: auto !important;")
		expect(result).toContain("scrollbar-width: none;")
	})

	it("does not inject vertical overflow hidden styles by default", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent("<!DOCTYPE html><html><body><div>Preview</div></body></html>")

		expect(result).not.toContain("overflow-y: auto !important;")
	})

	it("injects throttled tracked-rectangle refresh for inspector targets", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><div>Preview</div></body></html>",
			"",
			{ enableInlineInspectorFallback: true },
		)

		expect(result).toContain('TRACK: "MAGIC_INSPECTOR_TRACK"')
		expect(result).toContain('RECTS_CHANGED: "MAGIC_INSPECTOR_RECTS_CHANGED"')
		expect(result).toContain("requestAnimationFrame(refreshTrackedRects)")
		expect(result).toContain("lastTrackedRects")
		expect(result).toContain("function getInspectableTextContent")
	})

	it("selects an element through the injected inspector fallback script", async () => {
		const { getFullContent } = await import("../full-content")
		const html = getFullContent(
			"<!DOCTYPE html><html><body><h2>产品演示</h2></body></html>",
			"",
			{ enableInlineInspectorFallback: true },
		)
		const scriptMatch = html.match(
			/\(function\(\) \{\s*var INSPECTOR_MSG = \{[\s\S]*?\}\)\(\);/,
		)
		const inspectorScript = scriptMatch?.[0]
		expect(inspectorScript).toContain("function getInspectableTextContent")
		if (!inspectorScript) return

		const messages: unknown[] = []
		vi.spyOn(window.parent, "postMessage").mockImplementation((data) => {
			messages.push(data)
		})
		document.body.replaceChildren()
		document.body.innerHTML = "<h2>产品演示</h2>"
		new Function(inspectorScript)()
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "MAGIC_INSPECTOR_START", timestamp: Date.now() },
			}),
		)

		const title = document.querySelector("h2")
		expect(title).toBeTruthy()
		if (!title) return
		title.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

		expect(messages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "MAGIC_INSPECTOR_SELECT",
					elementInfo: expect.objectContaining({
						tagName: "h2",
						textContent: "产品演示",
					}),
				}),
			]),
		)
	})

	it("injects iframe content metrics only for document-flow fullscreen", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><div>Preview</div></body></html>",
			"",
			{
				reportContentMetrics: true,
				contentMetricsTargetOrigin: "https://magic.example.com",
			},
		)

		expect(result).toContain("__MAGIC_DOCUMENT_FLOW_METRICS__")
		expect(result).toContain(
			createIframeRuntimeScript("content-metrics", {
				parentOrigin: "https://magic.example.com",
			}),
		)
	})

	it("skips serviceWorker mock script when disabled", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><div>Preview</div></body></html>",
			"",
			{
				serviceWorkerMockMode: "off",
			},
		)

		expect(result).not.toContain(createIframeRuntimeScript("service-worker", { mode: "off" }))
		expect(result).not.toContain(createIframeRuntimeScript("service-worker", { mode: "auto" }))
	})

	it("injects serviceWorker mock script when force enabled", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><div>Preview</div></body></html>",
			"",
			{
				serviceWorkerMockMode: "on",
			},
		)

		expect(result).toContain(createIframeRuntimeScript("service-worker", { mode: "on" }))
	})

	it("places environment prelude before magic-api prelude and original head scripts", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><head><script>window.__USER_HEAD_SCRIPT__ = true</script></head><body><div>Preview</div></body></html>",
		)

		const magicIndex = result.indexOf('data-injected="magic-api"')
		const envIndex = result.indexOf("window.__MAGIC_INITIAL_LANG__")
		const userIndex = result.indexOf("window.__USER_HEAD_SCRIPT__")

		expect(magicIndex).toBeGreaterThanOrEqual(0)
		expect(envIndex).toBeGreaterThanOrEqual(0)
		expect(magicIndex).toBeGreaterThan(envIndex)
		expect(userIndex).toBeGreaterThan(magicIndex)
	})

	it("injects virtual storage snapshot before original head scripts", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><head><script>window.__USER_HEAD_SCRIPT__ = localStorage.getItem('theme')</script></head><body><div>Preview</div></body></html>",
			"",
			{
				virtualStorage: {
					protocol: "magic-html-virtual-storage/v1",
					renderId: "render-1",
					token: "token-1",
					namespace: "namespace-1",
					targetOrigin: "https://app.example.test",
					snapshot: {
						localStorage: { theme: "dark" },
						sessionStorage: { step: "2" },
						cookies: { locale: "zh_CN" },
						indexedDB: {},
					},
				},
			},
		)

		const storageIndex = result.indexOf("setupMagicVirtualStorage")
		const userIndex = result.indexOf("window.__USER_HEAD_SCRIPT__")

		expect(storageIndex).toBeGreaterThanOrEqual(0)
		expect(storageIndex).toBeLessThan(userIndex)
		expect(result).toContain('"namespace":"namespace-1"')
		expect(result).toContain('"theme":"dark"')
		expect(result).not.toContain("MAGIC:iframe:storage:")
	})
})
