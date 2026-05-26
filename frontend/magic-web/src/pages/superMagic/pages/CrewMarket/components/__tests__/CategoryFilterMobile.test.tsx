import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CategoryFilterMobile from "../CategoryFilterMobile"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => (key === "categories.allCrew" ? "All Crew" : key),
	}),
}))

class ResizeObserverMock {
	observe() {
		// no-op for jsdom
	}
	unobserve() {
		// no-op for jsdom
	}
	disconnect() {
		// no-op for jsdom
	}
}

/** Build categories for a horizontally overflowed tab strip in jsdom. */
function buildCategories(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		id: `cat-${index}`,
		name: `Category ${index}`,
		logo: "",
	}))
}

/** jsdom does not implement Element.scrollTo; polyfill for useCenteredHorizontalScroll. */
function installScrollToPolyfill() {
	if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollTo) {
		HTMLElement.prototype.scrollTo = vi.fn()
	}
}

describe("CategoryFilterMobile", () => {
	beforeEach(() => {
		vi.stubGlobal("ResizeObserver", ResizeObserverMock)
		installScrollToPolyfill()
	})

	it("calls onCategoryChange when a tab is clicked", () => {
		const onCategoryChange = vi.fn()

		render(
			<CategoryFilterMobile
				categories={buildCategories(2)}
				activeCategoryId="all"
				onCategoryChange={onCategoryChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("category-filter-cat-1"))

		expect(onCategoryChange).toHaveBeenCalledWith("cat-1")
	})

	it("scrolls the active tab into view when activeCategoryId changes", () => {
		const scrollToSpy = vi.spyOn(HTMLElement.prototype, "scrollTo")
		const categories = buildCategories(6)

		const { rerender } = render(
			<CategoryFilterMobile
				categories={categories}
				activeCategoryId="all"
				onCategoryChange={vi.fn()}
			/>,
		)

		const activeTab = screen.getByTestId("category-filter-cat-5")
		const scrollContainer = activeTab.parentElement?.parentElement as HTMLDivElement
		const tabWrapper = activeTab.parentElement as HTMLElement
		expect(scrollContainer).toBeTruthy()

		Object.defineProperty(scrollContainer, "clientWidth", {
			configurable: true,
			value: 200,
		})
		Object.defineProperty(scrollContainer, "scrollWidth", {
			configurable: true,
			value: 900,
		})
		Object.defineProperty(scrollContainer, "scrollLeft", {
			configurable: true,
			writable: true,
			value: 0,
		})

		const containerRect = { left: 0, width: 200, top: 0, height: 32 }
		vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(containerRect as DOMRect)

		const tabRect = { left: 520, width: 96, top: 0, height: 32 }
		vi.spyOn(tabWrapper, "getBoundingClientRect").mockReturnValue(tabRect as DOMRect)

		scrollToSpy.mockClear()
		rerender(
			<CategoryFilterMobile
				categories={categories}
				activeCategoryId="cat-5"
				onCategoryChange={vi.fn()}
			/>,
		)

		expect(scrollToSpy).toHaveBeenCalled()
		const lastCall = scrollToSpy.mock.calls.at(-1)?.[0] as { left: number; behavior: string }
		expect(lastCall.left).toBeGreaterThan(0)
		expect(lastCall.behavior).toBe("smooth")
	})
})
