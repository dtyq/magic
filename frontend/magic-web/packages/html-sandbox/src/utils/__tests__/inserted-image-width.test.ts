import { afterEach, describe, expect, it } from "vitest"
import { resolveInsertedImageNodeWidth } from "../inserted-image-width"

function createParent(styles?: Partial<CSSStyleDeclaration>): HTMLDivElement {
	const parent = document.createElement("div")
	if (styles?.width) parent.style.width = styles.width
	if (styles?.display) parent.style.display = styles.display
	if (styles?.padding) parent.style.padding = styles.padding
	document.body.appendChild(parent)
	return parent
}

function mockBoxWidth(element: HTMLElement, width: number, stretchedWidth = 800): void {
	Object.defineProperty(element, "offsetWidth", {
		configurable: true,
		get() {
			return element.style.width === "100%" ? stretchedWidth : width
		},
	})
	Object.defineProperty(element, "clientWidth", {
		configurable: true,
		get() {
			return width
		},
	})
}

describe("resolveInsertedImageNodeWidth", () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it("keeps percentage width for a padded block that fills the container", () => {
		const parent = createParent({ padding: "16px 24px" })
		mockBoxWidth(parent, 400, 448)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("100%")
	})

	it("keeps percentage width for block parents that fill the container", () => {
		const parent = createParent()

		expect(resolveInsertedImageNodeWidth(parent)).toBe("100%")
	})

	it("keeps percentage width when the parent has an explicit width", () => {
		const parent = createParent({ width: "320px" })
		mockBoxWidth(parent, 320)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("100%")
	})

	it("uses the measured width when the parent is fit-content", () => {
		const parent = createParent({ width: "fit-content" })
		mockBoxWidth(parent, 180)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("180px")
	})

	it("uses the measured width when the parent is inline-block without width", () => {
		const parent = createParent({ display: "inline-block" })
		mockBoxWidth(parent, 220)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("220px")
	})

	it("subtracts horizontal padding from the measured width", () => {
		const parent = createParent({ width: "fit-content", padding: "10px 20px" })
		mockBoxWidth(parent, 220)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("180px")
	})

	it("falls back when a content-sized parent has no measurable width", () => {
		const parent = createParent({ width: "fit-content" })
		mockBoxWidth(parent, 0)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("240px")
	})

	it("uses the measured width for a block nested in a fit-content ancestor", () => {
		const wrapper = createParent({ width: "fit-content" })
		const parent = document.createElement("section")
		wrapper.appendChild(parent)
		Object.defineProperty(parent, "offsetWidth", {
			configurable: true,
			get() {
				return 180
			},
		})
		Object.defineProperty(parent, "clientWidth", {
			configurable: true,
			get() {
				return 180
			},
		})

		expect(resolveInsertedImageNodeWidth(parent)).toBe("180px")
	})

	it("uses the measured width when a percent-width box sits in fit-content", () => {
		const wrapper = createParent({ width: "fit-content" })
		const parent = document.createElement("section")
		parent.style.width = "100%"
		wrapper.appendChild(parent)
		Object.defineProperty(parent, "offsetWidth", {
			configurable: true,
			get() {
				return 180
			},
		})
		Object.defineProperty(parent, "clientWidth", {
			configurable: true,
			get() {
				return 180
			},
		})

		expect(resolveInsertedImageNodeWidth(parent)).toBe("180px")
	})

	it("keeps percentage width when a content-sized ancestor has an explicit width", () => {
		const wrapper = createParent({ display: "inline-block", width: "320px" })
		const parent = document.createElement("section")
		wrapper.appendChild(parent)

		expect(resolveInsertedImageNodeWidth(parent)).toBe("100%")
	})
})
