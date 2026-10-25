import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PPTPresenterNextSlide from "../PPTPresenterNextSlide"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe("PPTPresenterNextSlide", () => {
	afterEach(() => vi.unstubAllGlobals())

	it("shows a retryable load failure and replaces it with the recovered slide", () => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
		const onRetry = vi.fn()
		const { rerender } = render(
			<PPTPresenterNextSlide isLastSlide={false} loadingError onRetry={onRetry} />,
		)
		expect(screen.getByRole("status")).toHaveTextContent("ppt.presenter.loadNextSlideFailed")
		expect(screen.queryByText("ppt.presenter.loadingNextSlide")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.retry" }))
		expect(onRetry).toHaveBeenCalledTimes(1)
		rerender(
			<PPTPresenterNextSlide
				isLastSlide={false}
				content="<main>Recovered</main>"
				onRetry={onRetry}
			/>,
		)
		expect(screen.queryByRole("status")).not.toBeInTheDocument()
		expect(screen.getByTitle("ppt.presenter.nextSlide")).toHaveAttribute(
			"srcdoc",
			"<main>Recovered</main>",
		)
	})

	it("contains a non-standard canvas and keeps the iframe isolated and unfocusable", () => {
		let resize!: ResizeObserverCallback
		const disconnect = vi.fn()
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: ResizeObserverCallback) {
					resize = callback
				}
				observe = vi.fn()
				disconnect = disconnect
			},
		)
		const { unmount } = render(
			<PPTPresenterNextSlide
				isLastSlide={false}
				content={
					'<main class="slide-container" data-width="1000" data-height="1000">Next</main>'
				}
			/>,
		)
		act(() =>
			resize(
				[{ contentRect: { width: 600, height: 300 } } as ResizeObserverEntry],
				{} as ResizeObserver,
			),
		)
		const frame = screen.getByTitle("ppt.presenter.nextSlide")
		expect(frame).toHaveStyle({
			width: "1000px",
			height: "1000px",
			left: "150px",
			top: "0px",
			transform: "scale(0.3)",
		})
		expect(frame).toHaveAttribute("sandbox", "allow-scripts")
		expect(frame).toHaveAttribute("tabindex", "-1")
		expect(frame).toHaveAttribute("inert")
		unmount()
		expect(disconnect).toHaveBeenCalled()
	})

	it("shows loading until content arrives and removes the preview at the end", () => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
		const { rerender } = render(<PPTPresenterNextSlide isLastSlide={false} />)
		expect(screen.getByRole("status")).toHaveTextContent("ppt.presenter.loadingNextSlide")
		rerender(<PPTPresenterNextSlide isLastSlide={false} content="<main>Next</main>" />)
		expect(screen.getByTitle("ppt.presenter.nextSlide")).toHaveAttribute(
			"srcdoc",
			"<main>Next</main>",
		)
		rerender(<PPTPresenterNextSlide isLastSlide content="<main>Previous</main>" />)
		expect(screen.queryByTitle("ppt.presenter.nextSlide")).not.toBeInTheDocument()
		expect(screen.getByRole("status")).toHaveTextContent("ppt.presenter.endOfPresentation")
	})
})
