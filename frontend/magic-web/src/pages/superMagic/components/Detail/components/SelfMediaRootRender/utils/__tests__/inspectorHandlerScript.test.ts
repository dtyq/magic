import { afterEach, describe, expect, it, vi } from "vitest"
import { INSPECTOR_HANDLER_SCRIPT } from "../inspectorHandlerScript"

type InspectorWindow = Window & {
	__MAGIC_INSPECTOR_HANDLER__?: boolean
}

function installInspectorHandler() {
	new Function(INSPECTOR_HANDLER_SCRIPT)()
}

function selectElement(element: Element) {
	element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
}

describe("INSPECTOR_HANDLER_SCRIPT", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		;(window as InspectorWindow).__MAGIC_INSPECTOR_HANDLER__ = false
		document.body.replaceChildren()
	})

	it("is valid JavaScript and reports structured element identity", () => {
		expect(() => new Function(INSPECTOR_HANDLER_SCRIPT)).not.toThrow()
		expect(INSPECTOR_HANDLER_SCRIPT).toContain("function getInspectableTextContent")
		expect(INSPECTOR_HANDLER_SCRIPT).toContain("resource: getElementResource(el)")
		expect(INSPECTOR_HANDLER_SCRIPT).toContain("domContext: getDomContext(el)")
		expect(INSPECTOR_HANDLER_SCRIPT).toContain("elementHtml: sanitizeOuterHTML(el)")
		expect(INSPECTOR_HANDLER_SCRIPT).toContain("selectorMatchCount: selectorMatchCount")
	})

	it("sends selected element info without video fallback copy", () => {
		const messages: unknown[] = []
		vi.spyOn(window.parent, "postMessage").mockImplementation((data) => {
			messages.push(data)
		})

		installInspectorHandler()

		const video = document.createElement("video")
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		document.body.appendChild(video)
		selectElement(video)

		expect(messages).toEqual([
			expect.objectContaining({
				type: "MAGIC_INSPECTOR_SELECT",
				elementInfo: expect.objectContaining({
					tagName: "video",
					textContent: "",
				}),
			}),
		])
	})

	it("sends authored text when selecting a text element", () => {
		const messages: unknown[] = []
		vi.spyOn(window.parent, "postMessage").mockImplementation((data) => {
			messages.push(data)
		})

		installInspectorHandler()

		const title = document.createElement("h2")
		title.textContent = "产品演示"
		document.body.appendChild(title)
		selectElement(title)

		expect(messages).toEqual([
			expect.objectContaining({
				type: "MAGIC_INSPECTOR_SELECT",
				elementInfo: expect.objectContaining({
					tagName: "h2",
					textContent: "产品演示",
				}),
			}),
		])
	})
})
