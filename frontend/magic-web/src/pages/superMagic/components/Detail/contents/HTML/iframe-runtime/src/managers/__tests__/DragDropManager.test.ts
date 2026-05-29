/**
 * DragDropManager tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CommandHistory } from "../../core/CommandHistory"
import { DragDropManager } from "../DragDropManager"

describe("DragDropManager", () => {
	let manager: DragDropManager
	let commandHistory: CommandHistory

	beforeEach(() => {
		document.body.innerHTML = ""
		commandHistory = new CommandHistory()
		manager = new DragDropManager(commandHistory)
	})

	afterEach(() => {
		manager.destroy()
		vi.restoreAllMocks()
		document.body.innerHTML = ""
	})

	it("shows a vertical indicator for horizontal insertion targets", () => {
		const { firstItem } = createHorizontalContainer()
		mockElementFromPoint(firstItem)

		manager.handleDragOver(160, 40)

		const indicator = document.querySelector<HTMLElement>("[data-drag-indicator='true']")
		expect(indicator?.style.width).toBe("2px")
		expect(indicator?.style.height).toBe("80px")
		expect(indicator?.style.left).toBe("200px")
		expect(indicator?.style.top).toBe("0px")
	})

	it("uses the x position when inserting into horizontal containers", () => {
		const { container, firstItem } = createHorizontalContainer()
		mockElementFromPoint(firstItem)

		manager.handleDragOver(120, 40)
		const success = manager.insertImage("./images/example.png")

		expect(success).toBe(true)
		expect(container.children[0].tagName).toBe("IMG")
		expect(container.children[1]).toBe(firstItem)
		expect(commandHistory.getUndoStackSize()).toBe(1)
	})

	it("does not animate indicator position or size across axis changes", () => {
		const { firstItem } = createHorizontalContainer()
		mockElementFromPoint(firstItem)

		manager.handleDragOver(160, 40)

		const indicator = document.querySelector<HTMLElement>("[data-drag-indicator='true']")
		expect(indicator?.style.transition).not.toContain("top")
		expect(indicator?.style.transition).not.toContain("left")
		expect(indicator?.style.transition).not.toContain("width")
		expect(indicator?.style.transition).not.toContain("height")
	})
})

function createHorizontalContainer() {
	const container = document.createElement("div")
	container.style.display = "flex"
	container.appendChild(createItem("first", { top: 0, left: 100, width: 100, height: 80 }))
	container.appendChild(createItem("second", { top: 0, left: 200, width: 100, height: 80 }))
	document.body.appendChild(container)

	return {
		container,
		firstItem: container.children[0],
		secondItem: container.children[1],
	}
}

function createItem(
	id: string,
	rect: { top: number; left: number; width: number; height: number },
) {
	const item = document.createElement("div")
	item.id = id
	item.style.display = "block"
	item.getBoundingClientRect = vi.fn(() => ({
		...rect,
		right: rect.left + rect.width,
		bottom: rect.top + rect.height,
		x: rect.left,
		y: rect.top,
		toJSON: () => ({}),
	}))
	return item
}

function mockElementFromPoint(element: Element) {
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() => element),
	})
}
