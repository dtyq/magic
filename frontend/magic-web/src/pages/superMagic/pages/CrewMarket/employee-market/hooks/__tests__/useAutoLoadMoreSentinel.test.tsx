import { act, render, screen } from "@testing-library/react"
import type { RefObject } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAutoLoadMoreSentinel } from "../useAutoLoadMoreSentinel"

interface TestComponentProps {
	rootRef?: RefObject<HTMLDivElement | null>
	disabled: boolean
	onLoadMore: () => void
}

function TestComponent({ rootRef, disabled, onLoadMore }: TestComponentProps) {
	const sentinelRef = useAutoLoadMoreSentinel({
		rootRef,
		disabled,
		onLoadMore,
	})

	return <div ref={sentinelRef} data-testid="auto-load-more-sentinel" />
}

describe("useAutoLoadMoreSentinel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("loads more when the sentinel enters the scroll viewport", () => {
		const observe = vi.fn()
		const disconnect = vi.fn()
		const intersectionObserver = vi.fn((callback: IntersectionObserverCallback) => ({
			observe,
			disconnect,
			unobserve: vi.fn(),
			takeRecords: vi.fn(),
			root: null,
			rootMargin: "",
			thresholds: [],
			callback,
		}))

		vi.stubGlobal("IntersectionObserver", intersectionObserver)

		const handleLoadMore = vi.fn()
		const viewport = document.createElement("div")
		const scrollViewportRef = { current: viewport }

		render(
			<TestComponent
				rootRef={scrollViewportRef}
				disabled={false}
				onLoadMore={handleLoadMore}
			/>,
		)

		expect(screen.getByTestId("auto-load-more-sentinel")).toBeInTheDocument()
		expect(intersectionObserver).toHaveBeenCalledTimes(1)
		expect(intersectionObserver.mock.calls[0]?.[1]).toMatchObject({
			root: viewport,
			rootMargin: "160px 0px",
		})

		const callback = intersectionObserver.mock.calls[0]?.[0] as IntersectionObserverCallback

		act(() => {
			callback(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			)
		})

		expect(handleLoadMore).toHaveBeenCalledTimes(1)
		expect(observe).toHaveBeenCalledTimes(1)
		expect(disconnect).not.toHaveBeenCalled()
	})

	it("does not create an observer while auto loading is disabled", () => {
		const intersectionObserver = vi.fn()
		vi.stubGlobal("IntersectionObserver", intersectionObserver)

		const handleLoadMore = vi.fn()

		render(<TestComponent disabled onLoadMore={handleLoadMore} />)

		expect(intersectionObserver).not.toHaveBeenCalled()
		expect(handleLoadMore).not.toHaveBeenCalled()
	})
})
