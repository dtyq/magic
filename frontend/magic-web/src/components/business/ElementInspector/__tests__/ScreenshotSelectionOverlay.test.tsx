import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScreenshotSelectionOverlay } from "../ScreenshotSelectionOverlay"
import { CurrentTabCaptureError } from "../screenshot"

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("ScreenshotSelectionOverlay", () => {
	it("captures the whole HTML viewport from the keyboard", async () => {
		const onCapture = vi.fn().mockResolvedValue(undefined)
		render(
			<ScreenshotSelectionOverlay
				containerWidth={640}
				containerHeight={360}
				onCapture={onCapture}
			/>,
		)

		fireEvent.keyDown(screen.getByTestId("html-screenshot-selection-overlay"), {
			key: "Enter",
		})

		await waitFor(() => {
			expect(onCapture).toHaveBeenCalledWith(
				{
					left: 0,
					top: 0,
					width: 640,
					height: 360,
				},
				expect.any(Function),
			)
		})
	})

	it("limits keyboard capture and pointer dragging to the rendered slide bounds", async () => {
		const onCapture = vi.fn().mockResolvedValue(undefined)
		render(
			<ScreenshotSelectionOverlay
				containerWidth={640}
				containerHeight={720}
				selectionBounds={{ left: 0, top: 180, width: 640, height: 360 }}
				onCapture={onCapture}
			/>,
		)

		const overlay = screen.getByTestId("html-screenshot-selection-overlay")
		vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
			left: 100,
			top: 50,
			width: 640,
			height: 720,
			right: 740,
			bottom: 770,
			x: 100,
			y: 50,
			toJSON: () => ({}),
		} as DOMRect)

		fireEvent.keyDown(overlay, { key: "Enter" })
		await waitFor(() => {
			expect(onCapture).toHaveBeenCalledWith(
				{
					left: 0,
					top: 180,
					width: 640,
					height: 360,
				},
				expect.any(Function),
			)
		})

		onCapture.mockClear()
		fireEvent(
			overlay,
			new MouseEvent("pointerdown", { bubbles: true, clientX: 120, clientY: 80 }),
		)
		fireEvent(
			overlay,
			new MouseEvent("pointerup", { bubbles: true, clientX: 160, clientY: 120 }),
		)
		expect(onCapture).not.toHaveBeenCalled()

		fireEvent(
			overlay,
			new MouseEvent("pointerdown", { bubbles: true, clientX: 120, clientY: 260 }),
		)
		fireEvent(
			overlay,
			new MouseEvent("pointerup", { bubbles: true, clientX: 260, clientY: 420 }),
		)
		await waitFor(() => {
			expect(onCapture).toHaveBeenCalledWith(
				{
					left: 20,
					top: 210,
					width: 140,
					height: 160,
				},
				expect.any(Function),
			)
		})
	})

	it("renders the selection box while dragging and captures the selected rectangle", async () => {
		const onCapture = vi.fn().mockResolvedValue(undefined)
		render(
			<ScreenshotSelectionOverlay
				containerWidth={640}
				containerHeight={360}
				onCapture={onCapture}
			/>,
		)

		const overlay = screen.getByTestId("html-screenshot-selection-overlay")
		vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
			left: 100,
			top: 50,
			width: 640,
			height: 360,
			right: 740,
			bottom: 410,
			x: 100,
			y: 50,
			toJSON: () => ({}),
		} as DOMRect)

		const firePointer = (type: string, clientX: number, clientY: number) => {
			fireEvent(overlay, new MouseEvent(type, { bubbles: true, clientX, clientY }))
		}
		firePointer("pointerdown", 140, 90)
		firePointer("pointermove", 340, 210)

		await waitFor(() => {
			expect(screen.getByTestId("html-screenshot-selection-box")).toHaveStyle({
				left: "40px",
				top: "40px",
				width: "200px",
				height: "120px",
			})
		})

		firePointer("pointerup", 340, 210)

		await waitFor(() => {
			expect(onCapture).toHaveBeenCalledWith(
				{
					left: 40,
					top: 40,
					width: 200,
					height: 120,
				},
				expect.any(Function),
			)
		})
	})

	it("converts visual pointer coordinates back to layout coordinates when scaled", async () => {
		const onCapture = vi.fn().mockResolvedValue(undefined)
		render(
			<ScreenshotSelectionOverlay
				containerWidth={800}
				containerHeight={400}
				onCapture={onCapture}
			/>,
		)

		const overlay = screen.getByTestId("html-screenshot-selection-overlay")
		vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
			left: 100,
			top: 50,
			width: 600,
			height: 300,
			right: 700,
			bottom: 350,
			x: 100,
			y: 50,
			toJSON: () => ({}),
		} as DOMRect)

		const firePointer = (type: string, clientX: number, clientY: number) => {
			fireEvent(overlay, new MouseEvent(type, { bubbles: true, clientX, clientY }))
		}
		firePointer("pointerdown", 160, 80)
		firePointer("pointermove", 460, 230)
		firePointer("pointerup", 460, 230)

		await waitFor(() => {
			expect(onCapture).toHaveBeenCalledWith(
				{
					left: 80,
					top: 40,
					width: 400,
					height: 200,
				},
				expect.any(Function),
			)
		})
	})

	it("keeps the selected region visible when capture fails", async () => {
		const onCapture = vi.fn().mockRejectedValue(new Error("capture failed"))
		render(
			<ScreenshotSelectionOverlay
				containerWidth={640}
				containerHeight={360}
				onCapture={onCapture}
			/>,
		)

		const overlay = screen.getByTestId("html-screenshot-selection-overlay")
		vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 640,
			height: 360,
			right: 640,
			bottom: 360,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)
		const firePointer = (type: string, clientX: number, clientY: number) => {
			fireEvent(overlay, new MouseEvent(type, { bubbles: true, clientX, clientY }))
		}

		firePointer("pointerdown", 20, 30)
		firePointer("pointermove", 220, 150)
		firePointer("pointerup", 220, 150)

		await waitFor(() => {
			expect(screen.getByTestId("html-screenshot-selection-box")).toBeInTheDocument()
			expect(screen.getByTestId("html-screenshot-selection-error")).toHaveTextContent(
				"stylePanel.inspector.screenshotCaptureFailed",
			)
		})
	})

	it("explains current-tab permission failures", async () => {
		const onCapture = vi
			.fn()
			.mockRejectedValue(
				new CurrentTabCaptureError("wrong-surface", "Choose the current tab"),
			)
		render(
			<ScreenshotSelectionOverlay
				containerWidth={640}
				containerHeight={360}
				captureUsesCurrentTab
				onCapture={onCapture}
			/>,
		)

		const overlay = screen.getByTestId("html-screenshot-selection-overlay")
		fireEvent.keyDown(overlay, { key: "Enter" })

		await waitFor(() => {
			expect(
				screen.getByText("stylePanel.inspector.screenshotCurrentTabHint"),
			).toBeInTheDocument()
			expect(screen.getByTestId("html-screenshot-selection-error")).toHaveTextContent(
				"stylePanel.inspector.screenshotCurrentTabRequired",
			)
		})
	})

	it("shows loading before hiding the selection UI for capture", async () => {
		let resolveCapture!: () => void
		let hideCaptureChrome!: () => Promise<void>
		const onCapture = vi.fn((_: unknown, beforeCurrentTabCapture?: () => Promise<void>) => {
			hideCaptureChrome = beforeCurrentTabCapture ?? (async () => undefined)
			return new Promise<void>((resolve) => {
				resolveCapture = resolve
			})
		})
		const onCaptureStateChange = vi.fn()
		render(
			<ScreenshotSelectionOverlay
				containerWidth={640}
				containerHeight={360}
				onCapture={onCapture}
				onCaptureStateChange={onCaptureStateChange}
			/>,
		)

		const overlay = screen.getByTestId("html-screenshot-selection-overlay")
		fireEvent.keyDown(overlay, { key: "Enter" })

		await waitFor(() => {
			expect(onCaptureStateChange).toHaveBeenCalledWith(true)
			expect(overlay).toHaveAttribute("data-capturing", "true")
			expect(overlay).toHaveAttribute("data-capture-phase", "loading")
			expect(overlay).not.toHaveStyle({ visibility: "hidden" })
			expect(
				screen.getByText("stylePanel.inspector.screenshotProcessing"),
			).toBeInTheDocument()
		})

		await waitFor(() => expect(onCapture).toHaveBeenCalled())
		expect(overlay).not.toHaveStyle({ visibility: "hidden" })

		await act(async () => {
			await hideCaptureChrome()
		})
		expect(overlay).toHaveAttribute("data-capture-phase", "capturing")
		expect(overlay).toHaveStyle({ visibility: "hidden" })

		await waitFor(() => expect(resolveCapture).toBeTypeOf("function"))
		resolveCapture()

		await waitFor(() => {
			expect(onCaptureStateChange).toHaveBeenLastCalledWith(false)
			expect(overlay).toHaveAttribute("data-capturing", "false")
			expect(overlay).not.toHaveStyle({ visibility: "hidden" })
		})
	})
})
