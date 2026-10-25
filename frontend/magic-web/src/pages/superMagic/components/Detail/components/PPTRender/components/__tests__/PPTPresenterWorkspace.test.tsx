import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PPTPresenterTimer from "../PPTPresenterTimer"
import { PresenterSplit } from "../PPTPresenterLayout"
import PPTPresenterFilmstrip from "../PPTPresenterFilmstrip"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: { number?: number }) =>
			values?.number ? `${key} ${values.number}` : key,
	}),
}))

describe("presenter workspace", () => {
	it("enlarges thumbnails when the filmstrip is resized vertically", () => {
		const callbacks: ResizeObserverCallback[] = []
		const OriginalObserver = globalThis.ResizeObserver
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: ResizeObserverCallback) {
					callbacks.push(callback)
				}
				observe = vi.fn()
				unobserve = vi.fn()
				disconnect = vi.fn()
			},
		)
		try {
			const view = render(
				<PPTPresenterFilmstrip
					slides={[{ id: "one", index: 0, path: "one.html", thumbnailUrl: "/one.png" }]}
					indices={[0]}
					activeIndex={0}
					disabled={false}
					onSelect={vi.fn()}
					onLoad={vi.fn()}
				/>,
			)
			const resize = (height: number) =>
				act(() =>
					callbacks.forEach((callback) =>
						callback(
							[{ contentRect: { width: 800, height } } as ResizeObserverEntry],
							{} as ResizeObserver,
						),
					),
				)
			const card = screen.getByLabelText("ppt.presenter.slideNumber 1")
			resize(200)
			const initialWidth = parseFloat(card.style.width)
			expect(card.style.height).toBe("188px")
			resize(300)
			expect(card.style.height).toBe("288px")
			expect(parseFloat(card.style.width)).toBeGreaterThan(initialWidth)
			resize(200)
			expect(parseFloat(card.style.width)).toBe(initialWidth)
			view.unmount()
		} finally {
			vi.stubGlobal("ResizeObserver", OriginalObserver)
		}
	})

	it("shows seven-segment elapsed time and restarts timing on reset", () => {
		vi.useFakeTimers()
		try {
			const view = render(<PPTPresenterTimer />)
			act(() => vi.advanceTimersByTime(65000))
			const display = screen.getByLabelText("ppt.presenter.elapsedTime")
			expect(display).toHaveTextContent("01:05")
			expect(display.querySelectorAll("polygon")).toHaveLength(28)
			expect(screen.queryByLabelText("ppt.presenter.stopTimer")).not.toBeInTheDocument()
			fireEvent.click(screen.getByLabelText("ppt.presenter.resetTimer"))
			expect(display).toHaveTextContent("00:00")
			act(() => vi.advanceTimersByTime(2000))
			expect(display).toHaveTextContent("00:02")
			view.unmount()
			expect(vi.getTimerCount()).toBe(0)
		} finally {
			vi.useRealTimers()
		}
	})

	it("bounds keyboard resizing and consumes navigation keys", () => {
		const navigate = vi.fn()
		render(
			<div onKeyDown={navigate}>
				<PresenterSplit label="resize" first="one" second="two" />
			</div>,
		)
		const handle = screen.getByRole("separator")
		fireEvent.keyDown(handle, { key: "ArrowLeft" })
		expect(handle).toHaveAttribute("aria-valuenow", "58")
		fireEvent.keyDown(handle, { key: "End" })
		fireEvent.keyDown(handle, { key: "ArrowRight" })
		expect(handle).toHaveAttribute("aria-valuenow", "80")
		expect(navigate).not.toHaveBeenCalled()
	})
	it("navigates using original indices and omits hidden slides", () => {
		const onSelect = vi.fn()
		const slides = [0, 1, 2].map((index) => ({
			id: String(index),
			path: `${index}.html`,
			index,
			thumbnailUrl: `/slide-${index}.png`,
		}))
		const view = render(
			<PPTPresenterFilmstrip
				slides={slides}
				indices={[0, 2]}
				activeIndex={2}
				disabled={false}
				onSelect={onSelect}
				onLoad={vi.fn()}
			/>,
		)
		expect(screen.queryByLabelText("ppt.presenter.slideNumber 2")).not.toBeInTheDocument()
		const third = screen.getByLabelText("ppt.presenter.slideNumber 3")
		expect(third).toHaveAttribute("aria-current", "page")
		fireEvent.click(third)
		expect(onSelect).toHaveBeenCalledWith(2)
		view.rerender(
			<PPTPresenterFilmstrip
				slides={slides}
				indices={[0, 2]}
				activeIndex={2}
				disabled
				onSelect={onSelect}
				onLoad={vi.fn()}
			/>,
		)
		expect(third).toBeDisabled()
	})
})
