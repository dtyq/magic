import { afterEach, describe, expect, it, vi } from "vitest"
import { CommandHistory } from "../../core/CommandHistory"
import { EditorBridge } from "../../core/EditorBridge"
import { StyleManager } from "../StyleManager"
import { TextStyleManager } from "../TextStyleManager"

describe("partial text color with generated class names", () => {
	const originalGetClientRects = Object.getOwnPropertyDescriptor(
		Range.prototype,
		"getClientRects",
	)
	afterEach(() => {
		window.getSelection()?.removeAllRanges()
		document.body.innerHTML = ""
		vi.restoreAllMocks()
		if (originalGetClientRects)
			Object.defineProperty(Range.prototype, "getClientRects", originalGetClientRects)
		else Reflect.deleteProperty(Range.prototype, "getClientRects")
	})
	it.each(["有雷阵雨", "37°C"])(
		"colors selected %s when the HTML uses arbitrary Tailwind classes",
		async (selectedText) => {
			document.body.innerHTML = `<main class="max-w-[1180px] lg:px-8"><div class="mt-4 text-[19px] font-medium text-white/90" contenteditable="true">多云间阴天，有雷阵雨、局部大雨，体感温度最高可达 37°C · 高温闷热</div></main>`
			const line = document.querySelector("main > div") as HTMLElement
			Object.defineProperty(line, "isContentEditable", { configurable: true, value: true })
			const original = line.innerHTML
			const bridge = new EditorBridge()
			vi.spyOn(bridge, "sendEvent").mockImplementation(() => undefined)
			Object.defineProperty(Range.prototype, "getClientRects", {
				configurable: true,
				value: () => [],
			})
			const history = new CommandHistory()
			const textManager = new TextStyleManager(history, bridge)
			const styleManager = new StyleManager(history)
			styleManager.setTextStyleManager(textManager)
			textManager.startMonitoring()
			try {
				const text = line.firstChild as Text
				const offset = text.data.indexOf(selectedText)
				const range = document.createRange()
				range.setStart(text, offset)
				range.setEnd(text, offset + selectedText.length)
				window.getSelection()!.addRange(range)
				document.dispatchEvent(new Event("selectionchange"))
				const selector = textManager.getTextSelection().range!.containerSelector
				expect(document.querySelector(selector)).toBe(line)
				await textManager.applyTextStyle(selector, { color: "#d03939" })
				const span = line.querySelector("span")!
				expect(span.textContent).toBe(selectedText)
				expect(span.style.color).toBe("rgb(208, 57, 57)")
				expect(line.textContent).toBe(original)
				const updated = line.innerHTML
				await styleManager.undo()
				expect(line.innerHTML).toBe(original)
				await styleManager.redo()
				expect(line.innerHTML).toBe(updated)
			} finally {
				textManager.stopMonitoring()
				bridge.destroy()
			}
		},
	)
})
