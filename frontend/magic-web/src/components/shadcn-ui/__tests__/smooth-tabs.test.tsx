import { afterEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { SmoothTabs } from "../smooth-tabs"

const tabs = [
	{ value: "a", label: "A" },
	{ value: "b", label: "B" },
]

describe("SmoothTabs indicator", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("measures in layout pixels while an ancestor is scaled (opening dialog)", () => {
		// The container is laid out 200px wide but rendered at half size by a zoom animation.
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
			this: HTMLElement,
		) {
			return this.dataset.testid === "tabs" ? 200 : 0
		})
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement,
		) {
			const rect =
				this.dataset.testid === "tabs"
					? { left: 100, width: 100 }
					: { left: 110, width: 40 }
			return { ...rect, top: 0, height: 20, right: 0, bottom: 0, x: 0, y: 0 } as DOMRect
		})

		const { getByTestId } = render(
			<SmoothTabs tabs={tabs} value="a" onChange={() => undefined} data-testid="tabs" />,
		)

		const indicator = getByTestId("tabs").querySelector<HTMLElement>(".absolute.z-0")
		expect(indicator?.style.width).toBe("80px")
		expect(indicator?.style.left).toBe("20px")
	})
})
