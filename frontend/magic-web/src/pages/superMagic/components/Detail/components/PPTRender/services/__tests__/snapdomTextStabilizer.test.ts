import { afterEach, describe, expect, it, vi } from "vitest"
import { stabilizeSingleLineTextForSnapdom } from "../snapdomTextStabilizer"

function setRect(element: HTMLElement, height: number): void {
	element.getBoundingClientRect = vi.fn(
		() =>
			({
				width: 300,
				height,
				top: 0,
				left: 0,
				right: 300,
				bottom: height,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect,
	)
}

describe("stabilizeSingleLineTextForSnapdom", () => {
	afterEach(() => {
		document.body.innerHTML = ""
		vi.restoreAllMocks()
	})

	it("sets nowrap on visually single-line text elements", () => {
		document.body.innerHTML = `<div id="title">Quarterly Growth Summary</div>`
		const title = document.getElementById("title") as HTMLElement
		title.style.lineHeight = "20px"
		title.style.paddingTop = "4px"
		title.style.paddingBottom = "4px"
		setRect(title, 28)

		stabilizeSingleLineTextForSnapdom(title)

		expect(title.style.getPropertyValue("white-space")).toBe("nowrap")
		expect(title.style.getPropertyPriority("white-space")).toBe("important")
	})

	it("does not change text elements whose height indicates multiple lines", () => {
		document.body.innerHTML = `<div id="body">Line one Line two Line three</div>`
		const body = document.getElementById("body") as HTMLElement
		body.style.lineHeight = "20px"
		setRect(body, 44)

		stabilizeSingleLineTextForSnapdom(body)

		expect(body.style.getPropertyValue("white-space")).toBe("")
	})

	it("restores the previous inline white-space after capture", () => {
		document.body.innerHTML = `<div id="label" style="white-space: normal;">One Line</div>`
		const label = document.getElementById("label") as HTMLElement
		label.style.lineHeight = "20px"
		setRect(label, 20)

		const restore = stabilizeSingleLineTextForSnapdom(label)
		expect(label.style.getPropertyValue("white-space")).toBe("nowrap")

		restore()

		expect(label.style.getPropertyValue("white-space")).toBe("normal")
		expect(label.style.getPropertyPriority("white-space")).toBe("")
	})
})
