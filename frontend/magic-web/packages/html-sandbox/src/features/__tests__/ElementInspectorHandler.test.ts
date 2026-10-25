import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { snapdom } from "@zumer/snapdom"
import { ElementInspectorHandler } from "../ElementInspectorHandler"
import { getElementSelector } from "../../utils/dom"

vi.mock("@zumer/snapdom", () => ({
	snapdom: vi.fn(),
}))

describe("ElementInspectorHandler", () => {
	let container: HTMLDivElement
	let postMessageSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		container = document.createElement("div")
		container.innerHTML = `
			<div class="art-wrap">
				<img class="art-img" src="images/first.png?token=first" alt="First" />
				<img class="art-img" src="images/target.png?token=secret" data-src="images/target-large.png?signature=hidden" data-token="private" alt="Target" style="background-image: url(images/private.png?token=secret)" />
				<img class="art-img" src="images/last.png?token=last" alt="Last" />
			</div>
		`
		document.body.appendChild(container)
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined)
	})

	afterEach(() => {
		postMessageSpy.mockRestore()
		container.remove()
	})

	it("ignores nested video fallback copy on container elements", () => {
		const handler = new ElementInspectorHandler()
		const wrapper = document.createElement("div")
		const video = document.createElement("video")
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		wrapper.appendChild(video)
		container.appendChild(wrapper)

		handler.activate()
		wrapper.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

		const selectCall = postMessageSpy.mock.calls.find(
			([message]) => (message as { type?: string }).type === "MAGIC_INSPECTOR_SELECT",
		)
		const info = (selectCall?.[0] as { elementInfo: { textContent: string; tagName: string } })
			.elementInfo

		expect(info.tagName).toBe("div")
		expect(info.textContent).toBe("")
	})

	it("ignores video fallback copy when collecting text content", () => {
		const handler = new ElementInspectorHandler()
		const video = document.createElement("video")
		video.src = "https://example.com/demo.mp4"
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		container.appendChild(video)

		handler.activate()
		video.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

		const selectCall = postMessageSpy.mock.calls.find(
			([message]) => (message as { type?: string }).type === "MAGIC_INSPECTOR_SELECT",
		)
		const info = (selectCall?.[0] as { elementInfo: { textContent: string; tagName: string } })
			.elementInfo

		expect(info.tagName).toBe("video")
		expect(info.textContent).toBe("")
	})

	it("reports normalized image identity and sibling context", () => {
		const handler = new ElementInspectorHandler()
		const target = container.querySelectorAll("img")[1]

		handler.activate()
		target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

		const selectCall = postMessageSpy.mock.calls.find(
			([message]) => (message as { type?: string }).type === "MAGIC_INSPECTOR_SELECT",
		)
		expect(selectCall).toBeDefined()
		const info = (
			selectCall?.[0] as {
				elementInfo: {
					selector: string
					selectorMatchCount: number
					resource: string
					attributes: Record<string, string>
					domContext: {
						siblingIndex: number
						sameTagIndex: number
						sameTagSiblingCount: number
						previousSibling: string
						nextSibling: string
					}
					elementHtml: string
				}
			}
		).elementInfo

		expect(info.selector).toContain("img.art-img:nth-of-type(2)")
		expect(info.selectorMatchCount).toBe(1)
		expect(info.resource).toBe("images/target.png")
		expect(info.attributes).toMatchObject({
			src: "images/target.png",
			"data-src": "images/target-large.png",
			alt: "Target",
		})
		expect(info.attributes).not.toHaveProperty("data-token")
		expect(info.domContext).toMatchObject({
			siblingIndex: 2,
			sameTagIndex: 2,
			sameTagSiblingCount: 3,
		})
		expect(info.domContext.previousSibling).toContain("images/first.png")
		expect(info.domContext.nextSibling).toContain("images/last.png")
		expect(info.elementHtml).toContain('src="images/target.png"')
		expect(info.elementHtml).toContain('data-src="images/target-large.png"')
		expect(info.elementHtml).not.toContain("token=secret")
		expect(info.elementHtml).not.toContain("data-token")
		expect(info.elementHtml).not.toContain("style=")
	})

	it("reports tracked element rectangles after scrolling", () => {
		const handler = new ElementInspectorHandler()
		const target = container.querySelectorAll("img")[1]
		let top = 120
		vi.spyOn(target, "getBoundingClientRect").mockImplementation(
			() =>
				({
					top,
					left: 40,
					width: 200,
					height: 100,
					right: 240,
					bottom: top + 100,
					x: 40,
					y: top,
					toJSON: () => ({}),
				}) as DOMRect,
		)
		const requestAnimationFrame = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((callback) => {
				callback(0)
				return 1
			})

		try {
			const selector = getElementSelector(target)
			handler.updateTrackedSelectors([selector])
			let rectMessage = postMessageSpy.mock.calls.find(
				([message]) =>
					(message as { type?: string }).type === "MAGIC_INSPECTOR_RECTS_CHANGED",
			)
			expect(rectMessage?.[0]).toMatchObject({
				type: "MAGIC_INSPECTOR_RECTS_CHANGED",
				rects: [{ selector, rect: { top: 120 } }],
			})

			postMessageSpy.mockClear()
			top = 20
			document.dispatchEvent(new Event("scroll", { bubbles: true }))
			rectMessage = postMessageSpy.mock.calls.find(
				([message]) =>
					(message as { type?: string }).type === "MAGIC_INSPECTOR_RECTS_CHANGED",
			)
			expect(rectMessage?.[0]).toMatchObject({ rects: [{ rect: { top: 20 } }] })
		} finally {
			requestAnimationFrame.mockRestore()
		}
	})

	it("reports the iframe scroll offset for cross-origin parents", () => {
		const handler = new ElementInspectorHandler()
		const requestAnimationFrame = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((callback) => {
				callback(0)
				return 1
			})
		const originalScrollX = window.scrollX
		const originalScrollY = window.scrollY
		Object.defineProperty(window, "scrollX", { configurable: true, value: 24 })
		Object.defineProperty(window, "scrollY", { configurable: true, value: 480 })

		try {
			handler.updateTrackedSelectors([])
			postMessageSpy.mockClear()
			document.dispatchEvent(new Event("scroll", { bubbles: true }))

			const scrollMessage = postMessageSpy.mock.calls.find(
				([message]) =>
					(message as { type?: string }).type === "MAGIC_INSPECTOR_SCROLL_CHANGED",
			)
			expect(scrollMessage?.[0]).toMatchObject({
				type: "MAGIC_INSPECTOR_SCROLL_CHANGED",
				left: 24,
				top: 480,
			})
		} finally {
			Object.defineProperty(window, "scrollX", { configurable: true, value: originalScrollX })
			Object.defineProperty(window, "scrollY", { configurable: true, value: originalScrollY })
			requestAnimationFrame.mockRestore()
		}
	})

	it("scrolls to a requested selector", () => {
		const handler = new ElementInspectorHandler()
		const target = document.createElement("section")
		target.id = "hero"
		container.appendChild(target)
		const scrollIntoView = vi.fn()
		Object.defineProperty(target, "scrollIntoView", {
			configurable: true,
			value: scrollIntoView,
		})

		handler.scrollToSelector("#hero")

		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "auto",
			block: "center",
			inline: "nearest",
		})
	})

	it("scrolls to a requested document position", () => {
		const handler = new ElementInspectorHandler()
		const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)

		try {
			handler.scrollToPosition({ left: -20, top: 700 })

			expect(scrollTo).toHaveBeenCalledWith({
				behavior: "auto",
				left: 0,
				top: 700,
			})
		} finally {
			scrollTo.mockRestore()
		}
	})

	it("captures a requested region and returns a PNG blob to the parent", async () => {
		Reflect.deleteProperty(globalThis, "OffscreenCanvas")
		const handler = new ElementInspectorHandler()
		vi.spyOn(document.body, "getBoundingClientRect").mockReturnValue({
			top: 0,
			left: 0,
			width: 320,
			height: 240,
			right: 320,
			bottom: 240,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 1
		})
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
		} as never)
		const encodeToBlob = vi
			.spyOn(HTMLCanvasElement.prototype, "toBlob")
			.mockImplementation((callback) => {
				callback(new Blob(["cropped"], { type: "image/png" }))
			})
		const toDataURL = vi
			.spyOn(HTMLCanvasElement.prototype, "toDataURL")
			.mockReturnValue("data:image/png;base64,QQ==")
		const toCanvas = vi.fn().mockResolvedValue(
			Object.assign(document.createElement("canvas"), {
				width: 80,
				height: 60,
			}),
		)
		const toBlob = vi.fn()
		vi.mocked(snapdom).mockResolvedValue({
			toCanvas,
			toBlob,
		} as never)

		await handler.captureScreenshot({
			requestId: "request-1",
			selection: { top: 10, left: 20, width: 80, height: 60 },
			outputSize: { width: 80, height: 60 },
		})

		const response = postMessageSpy.mock.calls.at(-1)?.[0] as {
			type: string
			requestId: string
			success: boolean
			blob: Blob
		}
		expect(response).toMatchObject({
			type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
			requestId: "request-1",
			success: true,
		})
		expect(response.blob).toBeInstanceOf(Blob)
		expect(toCanvas).toHaveBeenCalledOnce()
		expect(toBlob).not.toHaveBeenCalled()
		expect(encodeToBlob).not.toHaveBeenCalled()
		expect(toDataURL).toHaveBeenCalledWith("image/png")
		expect(snapdom).toHaveBeenCalledWith(
			container.ownerDocument.body,
			expect.objectContaining({
				width: 80,
				height: 60,
				clip: { x: 20, y: 10, width: 80, height: 60 },
			}),
		)
	})

	it("stops posting a screenshot after the host cancels the request", async () => {
		const handler = new ElementInspectorHandler()
		vi.spyOn(document.body, "getBoundingClientRect").mockReturnValue({
			top: 0,
			left: 0,
			width: 320,
			height: 240,
			right: 320,
			bottom: 240,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 1
		})
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
		} as never)
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
			callback(new Blob(["cropped"], { type: "image/png" }))
		})
		let finishSnapdom: (() => void) | undefined
		vi.mocked(snapdom).mockImplementation(
			() =>
				new Promise((resolve) => {
					finishSnapdom = () =>
						resolve({
							toCanvas: vi.fn().mockResolvedValue(document.createElement("canvas")),
							toBlob: vi.fn(),
						} as never)
				}),
		)

		const pending = handler.captureScreenshot({
			requestId: "request-cancel",
			selection: { top: 10, left: 20, width: 80, height: 60 },
			outputSize: { width: 80, height: 60 },
		})
		handler.cancelScreenshot("request-cancel")
		finishSnapdom?.()
		await pending

		expect(
			postMessageSpy.mock.calls.some(
				([message]) =>
					(message as { type?: string }).type === "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
			),
		).toBe(false)
	})
})
