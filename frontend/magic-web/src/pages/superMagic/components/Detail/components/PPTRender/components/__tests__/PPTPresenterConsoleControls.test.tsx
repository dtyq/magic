import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PPTPresenterConsoleControls from "../PPTPresenterConsoleControls"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("PPTPresenterConsoleControls", () => {
	it("dismisses the screen menu outside, on window blur, and on Escape", () => {
		render(
			<PPTPresenterConsoleControls
				activeIndex={0}
				totalSlides={4}
				isTransitioning={false}
				screens={[{ label: "External display" }]}
				selectedScreen={0}
				onPrevSlide={vi.fn()}
				onNextSlide={vi.fn()}
				onJumpToPage={vi.fn()}
				onSelectScreen={vi.fn()}
				onExit={vi.fn()}
			/>,
		)
		const trigger = screen.getByTestId("ppt-presenter-console-screen-button")
		const open = () => {
			fireEvent.keyDown(trigger, { key: "Enter" })
			expect(trigger).toHaveAttribute("aria-expanded", "true")
		}
		open()
		fireEvent.pointerDown(screen.getByRole("menu"))
		expect(trigger).toHaveAttribute("aria-expanded", "true")
		fireEvent.pointerDown(document.body)
		expect(trigger).toHaveAttribute("aria-expanded", "false")
		open()
		fireEvent.blur(window)
		expect(trigger).toHaveAttribute("aria-expanded", "false")
		open()
		fireEvent.keyDown(document.body, { key: "Escape" })
		expect(trigger).toHaveAttribute("aria-expanded", "false")
	})

	it("exposes local navigation and exit actions", () => {
		const onPrevSlide = vi.fn()
		const onNextSlide = vi.fn()
		const onExit = vi.fn()

		render(
			<PPTPresenterConsoleControls
				activeIndex={1}
				totalSlides={4}
				isTransitioning={false}
				screens={[]}
				selectedScreen={null}
				onPrevSlide={onPrevSlide}
				onNextSlide={onNextSlide}
				onJumpToPage={vi.fn()}
				onSelectScreen={vi.fn()}
				onExit={onExit}
			/>,
		)

		fireEvent.click(screen.getByTestId("ppt-presenter-console-prev-button"))
		fireEvent.click(screen.getByTestId("ppt-presenter-console-next-button"))
		fireEvent.click(screen.getByTestId("ppt-presenter-console-exit-button"))

		expect(onPrevSlide).toHaveBeenCalledTimes(1)
		expect(onNextSlide).toHaveBeenCalledTimes(1)
		expect(onExit).toHaveBeenCalledTimes(1)
	})

	it("jumps to a valid page from the indicator", () => {
		const onJumpToPage = vi.fn()

		render(
			<PPTPresenterConsoleControls
				activeIndex={0}
				totalSlides={4}
				isTransitioning={false}
				screens={[]}
				selectedScreen={null}
				onPrevSlide={vi.fn()}
				onNextSlide={vi.fn()}
				onJumpToPage={onJumpToPage}
				onSelectScreen={vi.fn()}
				onExit={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("ppt-presenter-console-page-indicator"))
		expect(screen.getByRole("spinbutton", { name: "detail.clickToJumpPage" })).toHaveFocus()
		fireEvent.change(screen.getByTestId("ppt-presenter-console-page-input"), {
			target: { value: "3" },
		})
		fireEvent.keyDown(screen.getByTestId("ppt-presenter-console-page-input"), { key: "Enter" })

		expect(onJumpToPage).toHaveBeenCalledWith(2)
	})

	it("resets elapsed time for a new presentation and releases its timer", () => {
		vi.useFakeTimers()
		const props = {
			activeIndex: 0,
			totalSlides: 4,
			isTransitioning: false,
			screens: [],
			selectedScreen: null,
			onPrevSlide: vi.fn(),
			onNextSlide: vi.fn(),
			onJumpToPage: vi.fn(),
			onSelectScreen: vi.fn(),
			onExit: vi.fn(),
		}
		try {
			const first = render(<PPTPresenterConsoleControls {...props} />)
			act(() => vi.advanceTimersByTime(65000))
			expect(screen.getByLabelText("ppt.presenter.elapsedTime")).toHaveTextContent("01:05")
			first.unmount()
			expect(vi.getTimerCount()).toBe(0)
			const next = render(<PPTPresenterConsoleControls {...props} />)
			expect(screen.getByLabelText("ppt.presenter.elapsedTime")).toHaveTextContent("00:00")
			next.unmount()
		} finally {
			vi.useRealTimers()
		}
	})
})
