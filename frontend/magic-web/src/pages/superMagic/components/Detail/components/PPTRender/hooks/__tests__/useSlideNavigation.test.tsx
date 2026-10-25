import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PPTStore } from "../../stores/PPTStore"
import { useSlideNavigation } from "../useSlideNavigation"

function setup(options: { presenting?: boolean; activeIndex?: number; hidden?: string[] } = {}) {
	const store = {
		slides: ["a.html", "b.html", "c.html"].map((path) => ({ path })),
		activeIndex: options.activeIndex ?? 0,
		setIsTransitioning: vi.fn(),
		setActiveIndex: vi.fn((index: number) => {
			store.activeIndex = index
		}),
	}
	let hidden = options.hidden ?? ["b.html"]
	const guard = vi.fn().mockResolvedValue(true)
	const onHiddenSlide = vi.fn()
	const onNoVisibleSlides = vi.fn()
	const hook = renderHook(() =>
		useSlideNavigation({
			store: store as unknown as PPTStore,
			checkBeforeNavigate: guard,
			isPresenting: () => options.presenting ?? false,
			getHiddenSlidePaths: () => hidden,
			hasPendingNavigationGuard: () => false,
			onHiddenSlide,
			onNoVisibleSlides,
		}),
	)
	return {
		...hook,
		store,
		guard,
		onHiddenSlide,
		onNoVisibleSlides,
		setHidden: (next: string[]) => {
			hidden = next
		},
	}
}

describe("PPT hidden page navigation", () => {
	it("keeps hidden pages available while editing", async () => {
		const { result, store } = setup()
		await act(() => result.current.changeSlide("next"))
		expect(store.activeIndex).toBe(1)
	})

	it("skips hidden pages both directions while presenting", async () => {
		const { result, store } = setup({ presenting: true })
		await act(() => result.current.changeSlide("next"))
		expect(store.activeIndex).toBe(2)
		await act(() => result.current.changeSlide("prev"))
		expect(store.activeIndex).toBe(0)
	})

	it("rejects internal links and page jumps to hidden pages", async () => {
		const { result, store, onHiddenSlide, guard } = setup({ presenting: true })
		await act(() => result.current.handleJumpToPage(1))
		expect(store.setActiveIndex).not.toHaveBeenCalled()
		expect(guard).not.toHaveBeenCalled()
		expect(onHiddenSlide).toHaveBeenCalledOnce()
	})

	it("checks visibility again after an asynchronous edit confirmation", async () => {
		const { result, store, guard, setHidden } = setup({ presenting: true })
		guard.mockImplementation(async () => {
			setHidden(["c.html"])
			return true
		})
		await act(() => result.current.handleJumpToPage(2))
		expect(store.setActiveIndex).not.toHaveBeenCalled()
	})

	it("starts after a hidden current page and wraps when no successor remains", async () => {
		const { result, store, setHidden } = setup({ activeIndex: 1 })
		await act(async () => {
			expect(await result.current.preparePresentation()).toBe(2)
		})
		setHidden(["c.html"])
		await act(async () => {
			expect(await result.current.preparePresentation()).toBe(0)
		})
		expect(store.activeIndex).toBe(0)
	})

	it("keeps visible clean entry synchronous and refuses an entirely hidden deck", () => {
		const { result, guard, setHidden, onNoVisibleSlides } = setup()
		expect(result.current.preparePresentation()).toBe(0)
		expect(guard).not.toHaveBeenCalled()
		setHidden(["a.html", "b.html", "c.html"])
		expect(result.current.preparePresentation()).toBeNull()
		expect(onNoVisibleSlides).toHaveBeenCalledOnce()
	})
})
