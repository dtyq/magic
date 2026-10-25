import Konva from "konva"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BaseElement } from "../BaseElement"
import type { LayerElement } from "../../../document/types"

class TestElement extends BaseElement<LayerElement> {
	render(): Konva.Node | null {
		return null
	}

	update(): boolean {
		return false
	}

	public setMountedNode(node: Konva.Node | null): void {
		this.node = node
	}
}

class FixedSizeTestElement extends TestElement {
	public override getTransformConstraints() {
		return { enabledAnchors: [] }
	}
}

function createElement(options: { active?: boolean; transforming?: boolean } = {}) {
	const handlers = new Map<string, () => void>()
	const canvas = {
		transformManager: {
			isTransformInteractionActive: vi.fn(() => options.active ?? false),
			isTransforming: vi.fn(() => options.transforming ?? false),
		},
		eventEmitter: {
			on: vi.fn((eventType: string, handler: () => void) => {
				handlers.set(eventType, handler)
				return () => handlers.delete(eventType)
			}),
		},
	} as unknown as ConstructorParameters<typeof TestElement>[1]

	const element = new TestElement(
		{
			id: "image-1",
			type: "image",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as LayerElement,
		canvas,
	)
	element.setMountedNode(new Konva.Group())
	const rerender = vi.spyOn(element, "rerender").mockReturnValue(null)

	return { element, handlers, rerender }
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("BaseElement size editing capability", () => {
	it("uses the default Transformer anchors as editable size support", () => {
		const { element } = createElement()

		expect(element.supportsSizeEditing()).toBe(true)
	})

	it("treats an explicit empty anchor list as fixed size", () => {
		const element = Object.create(FixedSizeTestElement.prototype) as FixedSizeTestElement

		expect(element.supportsSizeEditing()).toBe(false)
	})
})

describe("BaseElement transform-idle rerender", () => {
	it("rerenders immediately when the element is not in an active transform", () => {
		const { element, rerender } = createElement()

		element.rerenderWhenTransformIdle()

		expect(rerender).toHaveBeenCalledTimes(1)
	})

	it("defers resource rerender until the active transform ends", () => {
		let rafCallback: FrameRequestCallback | undefined
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((callback: FrameRequestCallback) => {
				rafCallback = callback
				return 1
			}),
		)
		vi.stubGlobal("cancelAnimationFrame", vi.fn())

		const { element, handlers, rerender } = createElement({
			active: true,
			transforming: true,
		})

		element.rerenderWhenTransformIdle()

		expect(rerender).not.toHaveBeenCalled()
		handlers.get("elements:transform:dragend")?.()
		expect(rerender).not.toHaveBeenCalled()

		rafCallback?.(0)

		expect(rerender).toHaveBeenCalledTimes(1)
	})

	it("flushes deferred resource rerender when a transform intent ends before dragstart", () => {
		let rafCallback: FrameRequestCallback | undefined
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((callback: FrameRequestCallback) => {
				rafCallback = callback
				return 1
			}),
		)
		vi.stubGlobal("cancelAnimationFrame", vi.fn())

		const { element, handlers, rerender } = createElement({
			active: true,
			transforming: true,
		})

		element.rerenderWhenTransformIdle()
		handlers.get("elements:transform:intentend")?.()
		rafCallback?.(0)

		expect(rerender).toHaveBeenCalledTimes(1)
	})
})
