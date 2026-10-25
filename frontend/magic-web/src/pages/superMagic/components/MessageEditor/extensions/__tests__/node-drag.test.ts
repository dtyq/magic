import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	isMagicNodeDragInProgress,
	MAGIC_NODE_DRAG_MIME,
	resolveDroppedNodeAttrs,
	setMagicNodeDragData,
	shouldSuppressNativeDrag,
} from "../node-drag"

function createDragEvent(clientX = 120, clientY = 140) {
	return {
		clientX,
		clientY,
		dataTransfer: {
			types: [MAGIC_NODE_DRAG_MIME],
			effectAllowed: "",
			setData: vi.fn(),
			setDragImage: vi.fn(),
		},
	} as unknown as DragEvent
}

describe("magic node drag preview", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
	})

	it("keeps the source node appearance and follows the pointer", () => {
		const source = document.createElement("span")
		source.className = "magic-mention source-chip"
		source.textContent = "@metric-map.html"
		source.setAttribute("draggable", "true")
		source.setAttribute("data-magic-editor-node", "true")
		const decorativeIcon = document.createElement("span")
		decorativeIcon.setAttribute("data-drag-preview-hidden", "true")
		source.appendChild(decorativeIcon)
		const previewIcon = document.createElement("span")
		previewIcon.setAttribute("data-drag-preview-icon", "true")
		previewIcon.textContent = "◉"
		source.appendChild(previewIcon)
		vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
			x: 80,
			y: 100,
			width: 180,
			height: 24,
			top: 100,
			right: 260,
			bottom: 124,
			left: 80,
			toJSON: () => ({}),
		})
		document.body.appendChild(source)

		const event = createDragEvent()
		setMagicNodeDragData(
			event,
			"mention",
			{ data: { name: "metric-map.html" } },
			undefined,
			source,
		)

		const preview = document.body.lastElementChild as HTMLElement
		expect(preview).toHaveClass("magic-mention", "source-chip")
		expect(preview).toHaveTextContent("@metric-map.html")
		expect(preview).not.toHaveAttribute("draggable")
		expect(preview).not.toHaveAttribute("data-magic-editor-node")
		expect(preview.querySelector("[data-drag-preview-hidden]")).toBeNull()
		expect(preview).toHaveTextContent("◉")
		expect(preview.querySelector("[data-drag-preview-icon]")).toBeNull()
		expect(preview.style.position).toBe("fixed")
		expect(preview.style.backgroundColor).toBe("rgb(255, 255, 255)")
		expect(preview.style.left).toBe("132px")
		expect(preview.style.top).toBe("152px")
		expect(document.documentElement).toHaveClass("magic-node-dragging")
		expect(event.dataTransfer?.setData).toHaveBeenCalledTimes(1)
		expect(event.dataTransfer?.setData).toHaveBeenCalledWith(
			MAGIC_NODE_DRAG_MIME,
			expect.any(String),
		)

		document.dispatchEvent(new Event("dragend", { bubbles: true }))
		expect(document.documentElement).not.toHaveClass("magic-node-dragging")
	})
})

describe("resolveDroppedNodeAttrs", () => {
	it("clears the inspector screenshot captureId when copying from outside the editor", () => {
		const attrs = resolveDroppedNodeAttrs(
			"inspector-detail",
			{
				selector: "#hero",
				captureId: "element:#hero:1",
			},
			true,
		)

		expect(attrs.selector).toBe("#hero")
		expect(attrs.captureId).toBeNull()
	})

	it("keeps the inspector screenshot captureId when moving inside the editor", () => {
		const attrs = resolveDroppedNodeAttrs(
			"inspector-detail",
			{
				selector: "#hero",
				captureId: "element:#hero:1",
			},
			false,
		)

		expect(attrs.captureId).toBe("element:#hero:1")
	})
})

describe("native drag suppression during pointer node drag", () => {
	beforeEach(() => {
		document.documentElement.classList.remove(
			"magic-node-pointer-pending",
			"magic-node-dragging",
		)
	})

	it("treats a pending pointer node drag as in progress", () => {
		expect(isMagicNodeDragInProgress()).toBe(false)
		document.documentElement.classList.add("magic-node-pointer-pending")
		expect(isMagicNodeDragInProgress()).toBe(true)
	})

	it("cancels native dragstart while a pointer node drag is pending", () => {
		document.documentElement.classList.add("magic-node-pointer-pending")
		expect(
			shouldSuppressNativeDrag({
				target: document.body,
			} as unknown as DragEvent),
		).toBe(true)
	})

	it("cancels native dragstart from a magic editor node", () => {
		const node = document.createElement("span")
		node.setAttribute("data-magic-editor-node", "true")
		document.body.appendChild(node)

		expect(shouldSuppressNativeDrag({ target: node } as unknown as DragEvent)).toBe(true)
	})
})
