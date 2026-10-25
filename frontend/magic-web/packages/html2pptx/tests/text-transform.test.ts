// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import type { SlideConfig } from "../src/api/options"
import { collectElements } from "../src/collector/collectElements"
import type { ElementNode } from "../src/ir/dom"
import { parseTextNodes } from "../src/parsers/parseText"
import { CSS_IDENTITY_TRANSFORM } from "../src/shared/transform-measurement"
import { getGlobalTransform } from "../src/shared/unit"

const originalDOMMatrix = globalThis.DOMMatrix
const originalGetClientRects = Range.prototype.getClientRects

const config: SlideConfig = {
	htmlWidth: 1920,
	htmlHeight: 1080,
	slideWidth: 20,
	slideHeight: 11.25,
}

afterEach(() => {
	Object.defineProperty(globalThis, "DOMMatrix", {
		configurable: true,
		writable: true,
		value: originalDOMMatrix,
	})
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true,
		value: originalGetClientRects,
	})
	document.body.innerHTML = ""
	vi.restoreAllMocks()
})

describe("editable text transform safety", () => {
	it("keeps sub-degree rotation precision for a simple uniform transform", () => {
		installDOMMatrix()
		const angle = 0.4 * (Math.PI / 180)
		const node = createTransformNode(
			`matrix(${Math.cos(angle)}, ${Math.sin(angle)}, ${-Math.sin(angle)}, ${Math.cos(angle)}, 0, 0)`,
		)

		const transform = getGlobalTransform(node)

		expect(transform.rotation).toBeCloseTo(0.4, 6)
		expect(transform.textSafe).toBe(true)
	})

	it("keeps a simple rotation editable with a non-centered transform origin", () => {
		installDOMMatrix()
		const node = createTransformNode("matrix(0, 1, -1, 0, 0, 0)")
		node.style.transformOrigin = "0px 0px"

		const transform = getGlobalTransform(node)

		expect(transform.rotation).toBe(90)
		expect(transform.textSafe).toBe(true)
	})

	it("supports independent CSS rotate and scale properties", () => {
		const node = createTransformNode("none")
		node.style.rotate = "90deg"
		node.style.scale = "1.5"

		const transform = getGlobalTransform(node)

		expect(transform.rotation).toBe(90)
		expect(transform.scaleX).toBe(1.5)
		expect(transform.scaleY).toBe(1.5)
		expect(transform.textSafe).toBe(true)
	})

	it("marks skew and non-uniform scale as unsafe for editable text", () => {
		installDOMMatrix()

		expect(getGlobalTransform(createTransformNode("matrix(1, 0, 0.2, 1, 0, 0)")).textSafe).toBe(
			false,
		)
		expect(getGlobalTransform(createTransformNode("matrix(2, 0, 0, 1, 0, 0)")).textSafe).toBe(
			false,
		)
	})

	it("keeps floating layout dimensions and maps mixed direct text before rotating it", () => {
		installDOMMatrix()
		document.body.innerHTML = `
			<div id="row" style="font: 20px/28px Arial; transform: matrix(0, 1, -1, 0, 0, 0); transform-origin: 0 0">
				<i></i>Label
			</div>
		`
		const row = document.querySelector("#row") as HTMLDivElement
		const icon = row.querySelector("i") as HTMLElement
		const directText = Array.from(row.childNodes).find(
			(child) => child.nodeType === Node.TEXT_NODE && child.textContent?.includes("Label"),
		) as Text
		directText.textContent = "Label"

		Object.defineProperties(row, {
			offsetWidth: { configurable: true, value: 200 },
			offsetHeight: { configurable: true, value: 40 },
		})
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
			if (this === document.body) return rect(0, 0, 500, 500)
			if (this === row) {
				return row.style.transform === CSS_IDENTITY_TRANSFORM
					? rect(100, 200, 300.4, 240.25)
					: rect(-240.25, 100, -200, 300.4)
			}
			if (this === icon) return rect(100, 200, 120, 220)
			if (this.tagName === "SPAN" && this.parentElement === row) {
				return rect(150.2, 206.125, 230.7, 228.375)
			}
			return rect(0, 0, 0, 0)
		})
		Object.defineProperty(Range.prototype, "getClientRects", {
			configurable: true,
			value: () => [rect(150.2, 206.125, 230.7, 228.375)],
		})

		const nodes = collectElements(document, window)
		const rowNode = nodes.find((node) => node.element === row)
		expect(rowNode?.layout.offsetWidth).toBe(200)
		expect(rowNode?.layout.offsetHeight).toBe(40)
		expect(rowNode?.layout.layoutWidth).toBeCloseTo(200.4, 6)
		expect(rowNode?.layout.layoutHeight).toBeCloseTo(40.25, 6)
		if (!rowNode) throw new Error("row node expected")

		const result = parseTextNodes(
			rowNode,
			{ type: "", x: 0, y: 0, w: 0, h: 0, zOrder: 1 },
			config,
		)

		expect(result).toHaveLength(1)
		expect(result[0].rotate).toBe(90)
		expect(result[0].x * 96).toBeCloseTo(-257.5, 6)
		expect(result[0].y * 96).toBeCloseTo(176.45, 6)
		expect(result[0].w * 96).toBeCloseTo(80.5, 6)
		expect(result[0].h * 96).toBeCloseTo(28, 6)
		expect(row.style.transform).toBe("matrix(0, 1, -1, 0, 0, 0)")
	})

	it("preserves transformed containing blocks while measuring layout size", () => {
		installDOMMatrix()
		document.body.innerHTML = `
			<div id="container" style="position: relative; width: 200px; height: 200px; transform: matrix(0, 1, -1, 0, 0, 0)">
				<div id="absolute" style="position: absolute; width: 50%; height: 40px">Text wraps here</div>
			</div>
		`
		const container = document.querySelector("#container") as HTMLDivElement
		const absolute = document.querySelector("#absolute") as HTMLDivElement
		let measuredAfterRemovingContainingBlock = false

		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement,
		) {
			if (this === document.body) return rect(0, 0, 800, 600)
			if (this === container) {
				return container.style.transform === CSS_IDENTITY_TRANSFORM
					? rect(100, 100, 300, 300)
					: rect(-300, 100, -100, 300)
			}
			if (this === absolute) {
				if (container.style.transform === "none") {
					measuredAfterRemovingContainingBlock = true
					return rect(0, 0, 400, 40)
				}
				return container.style.transform === CSS_IDENTITY_TRANSFORM
					? rect(100, 100, 200, 140)
					: rect(-140, 100, -100, 200)
			}
			return rect(0, 0, 0, 0)
		})

		const nodes = collectElements(document, window)
		const absoluteNode = nodes.find((node) => node.element === absolute)

		expect(absoluteNode?.layout.layoutWidth).toBe(100)
		expect(measuredAfterRemovingContainingBlock).toBe(false)
		expect(container.style.transform).toBe("matrix(0, 1, -1, 0, 0, 0)")
	})

	it("neutralizes and restores independent transforms during collection", () => {
		document.body.innerHTML = `
			<div id="individual" style="width: 100px; height: 40px; rotate: 90deg; scale: 1.5">Text</div>
		`
		const element = document.querySelector("#individual") as HTMLDivElement
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement,
		) {
			if (this === document.body) return rect(0, 0, 500, 500)
			if (this === element) {
				return element.style.rotate === "none" && element.style.scale === "none"
					? rect(100, 100, 200, 140)
					: rect(70, 75, 130, 225)
			}
			return rect(0, 0, 0, 0)
		})

		const nodes = collectElements(document, window)
		const node = nodes.find((candidate) => candidate.element === element)
		if (!node) throw new Error("individual transform node expected")

		expect(node.layout.layoutWidth).toBe(100)
		expect(node.layout.layoutHeight).toBe(40)
		expect(node.style.rotate).toBe("90deg")
		expect(node.style.scale).toBe("1.5")
		expect(getGlobalTransform(node)).toMatchObject({
			rotation: 90,
			scaleX: 1.5,
			scaleY: 1.5,
			textSafe: true,
		})
		expect(element.style.rotate).toBe("90deg")
		expect(element.style.scale).toBe("1.5")
	})

	it("finds browser lines before rotating sole-owner text", () => {
		installDOMMatrix()
		document.body.innerHTML = `
			<div id="rotated-lines" style="width: 100px; height: 40px; font: 20px/20px Arial; word-break: break-all; transform: matrix(0, 1, -1, 0, 0, 0); transform-origin: 0 0">ABCDEFGH</div>
		`
		const row = document.querySelector("#rotated-lines") as HTMLDivElement
		Object.defineProperties(row, {
			offsetWidth: { configurable: true, value: 100 },
			offsetHeight: { configurable: true, value: 40 },
		})
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement,
		) {
			if (this === document.body) return rect(0, 0, 500, 500)
			if (this === row) {
				return row.style.transform === CSS_IDENTITY_TRANSFORM
					? rect(100, 200, 200, 240)
					: rect(-240, 100, -200, 200)
			}
			return rect(0, 0, 0, 0)
		})
		Object.defineProperty(Range.prototype, "getClientRects", {
			configurable: true,
			value(this: Range) {
				const firstLine = rect(100, 200, 180, 220)
				if (this.endOffset <= 4) return [firstLine]
				if (row.style.transform === CSS_IDENTITY_TRANSFORM) {
					return [firstLine, rect(100, 220, 180, 240)]
				}
				// The two original rows become side-by-side columns with the same
				// vertical anchors after a 90-degree paint transform.
				return [rect(-220, 100, -200, 180), rect(-240, 100, -220, 180)]
			},
		})

		const collected = collectElements(document, window)
		const rowNode = collected.find((node) => node.element === row)
		if (!rowNode) throw new Error("rotated row node expected")
		const base = { type: "", x: 0, y: 0, w: 0, h: 0, zOrder: 1 }

		const plain = parseTextNodes(rowNode, base, config)
		expect(plain[0].rotate).toBe(90)
		expect(Array.isArray(plain[0].text)).toBe(true)
		if (!Array.isArray(plain[0].text)) throw new Error("visual-line runs expected")
		expect(plain[0].text.map((run) => run.text)).toEqual(["ABCD", "EFGH"])
		expect(plain[0].text[1].options?.softBreakBefore).toBe(true)
		expect(row.style.transform).toBe("matrix(0, 1, -1, 0, 0, 0)")
	})
})

function installDOMMatrix(): void {
	class TestDOMMatrix {
		a: number
		b: number
		c: number
		d: number
		is2D = true

		constructor(value: string) {
			const values = value
				.replace(/^matrix\(|\)$/g, "")
				.split(",")
				.map((part) => Number.parseFloat(part.trim()))
			;[this.a, this.b, this.c, this.d] = values
		}
	}

	Object.defineProperty(globalThis, "DOMMatrix", {
		configurable: true,
		writable: true,
		value: TestDOMMatrix,
	})
}

function createTransformNode(transform: string): ElementNode {
	return {
		style: {
			transform,
			transformOrigin: "50px 14px",
		},
		layout: { offsetWidth: 100, offsetHeight: 28 },
		rect: { x: 0, y: 0, w: 100, h: 28 },
		parent: null,
	} as ElementNode
}

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
	return {
		left,
		top,
		right,
		bottom,
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
		toJSON: () => ({}),
	} as DOMRect
}
