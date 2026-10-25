import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RecordingDetailAudioBar } from "../RecordingDetailAudioBar"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { rate?: string }) => {
			if (key === "detail.player.playbackSpeed") return `${options?.rate ?? ""}x`
			if (key === "detail.pause") return "Pause"
			if (key === "detail.play") return "Play"
			return key
		},
	}),
}))

// The base barrel initializes the i18n store. Keep MagicTooltip as a pass-through so the more-menu trigger still renders.
vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

/** Radix menus toggle on Enter. A click alone does not open this trigger in jsdom. */
function openCollapsedMoreMenu() {
	const trigger = screen.getByTestId("recording-detail-player-more-trigger")
	trigger.focus()
	fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" })
}

describe("RecordingDetailAudioBar", () => {
	const baseProps = {
		audioRef: { current: null },
		audioUrl: "test.mp3",
		durationSec: 125,
		currentSec: 10,
		playing: false,
		expanded: false,
		rate: 1,
		peakNorms: [0.2, 0.8, 0.4],
		onExpandedChange: vi.fn(),
		onTogglePlay: vi.fn(),
		onSeek: vi.fn(),
		onPlaybackRateChange: vi.fn(),
	}

	it("renders expanded controls with prototype skip icons", () => {
		render(<RecordingDetailAudioBar {...baseProps} expanded />)

		expect(screen.getByText("00:00:10")).toBeInTheDocument()
		expect(screen.getByLabelText("detail.player.skipBackAria")).toBeInTheDocument()
		expect(screen.getByLabelText("detail.player.skipForwardAria")).toBeInTheDocument()
	})

	it("uses default ±15s skip handlers when callbacks are omitted", () => {
		const onSeek = vi.fn()
		render(<RecordingDetailAudioBar {...baseProps} expanded currentSec={30} onSeek={onSeek} />)

		fireEvent.click(screen.getByLabelText("detail.player.skipBackAria"))
		fireEvent.click(screen.getByLabelText("detail.player.skipForwardAria"))

		expect(onSeek).toHaveBeenNthCalledWith(1, 15)
		expect(onSeek).toHaveBeenNthCalledWith(2, 45)
	})

	it("opens playback rate menu in expanded mode", () => {
		const onPlaybackRateChange = vi.fn()
		render(
			<RecordingDetailAudioBar
				{...baseProps}
				expanded
				onPlaybackRateChange={onPlaybackRateChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("recording-detail-player-rate-trigger"))
		fireEvent.click(screen.getByRole("option", { name: "1.5x" }))
		expect(onPlaybackRateChange).toHaveBeenCalledWith(1.5)
	})

	it("requests expanded mode when the collapsed maximize trigger is clicked", () => {
		const onExpandedChange = vi.fn()
		render(<RecordingDetailAudioBar {...baseProps} onExpandedChange={onExpandedChange} />)

		fireEvent.click(screen.getByLabelText("detail.player.expandPlayerAria"))

		expect(onExpandedChange).toHaveBeenCalledWith(true)
	})

	it("keeps the collapsed expand glyph aligned with skip control size", () => {
		render(<RecordingDetailAudioBar {...baseProps} collapsedTransportControls />)

		const expand = screen.getByLabelText("detail.player.expandPlayerAria")
		expect(expand.className).toContain("size-7")
		expect(expand.querySelector("svg")?.getAttribute("width")).toBe("20")
	})

	it("keeps the mobile collapsed expand glyph at the original lucide size", () => {
		render(<RecordingDetailAudioBar {...baseProps} />)

		const expand = screen.getByLabelText("detail.player.expandPlayerAria")
		expect(expand.querySelector("svg")?.getAttribute("class")).toContain("size-5")
	})

	it("hides rate and skip controls in the default collapsed row", () => {
		render(<RecordingDetailAudioBar {...baseProps} />)

		expect(screen.queryByTestId("recording-detail-player-more-trigger")).not.toBeInTheDocument()
		expect(screen.queryByTestId("recording-detail-player-rate-trigger")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("recording-detail-player-skip-back-button"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("recording-detail-player-skip-forward-button"),
		).not.toBeInTheDocument()
	})

	it("keeps collapsed rate and skip controls inside the more menu", () => {
		const onSeek = vi.fn()
		const onPlaybackRateChange = vi.fn()
		const onExpandedChange = vi.fn()
		render(
			<RecordingDetailAudioBar
				{...baseProps}
				collapsedTransportControls
				currentSec={30}
				onSeek={onSeek}
				onPlaybackRateChange={onPlaybackRateChange}
				onExpandedChange={onExpandedChange}
			/>,
		)

		expect(screen.queryByTestId("recording-detail-player-rate-trigger")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("recording-detail-player-skip-back-button"),
		).not.toBeInTheDocument()

		openCollapsedMoreMenu()
		const menu = screen.getByTestId("recording-detail-player-more-content")
		expect(menu).toHaveAttribute("data-side", "bottom")

		fireEvent.click(screen.getByTestId("recording-detail-player-skip-back-button"))
		openCollapsedMoreMenu()
		fireEvent.click(screen.getByTestId("recording-detail-player-skip-forward-button"))
		expect(onSeek).toHaveBeenNthCalledWith(1, 15)
		expect(onSeek).toHaveBeenNthCalledWith(2, 45)

		openCollapsedMoreMenu()
		expect(screen.getByTestId("recording-detail-player-rate-content")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("menuitemradio", { name: "1.5x" }))
		expect(onPlaybackRateChange).toHaveBeenCalledWith(1.5)

		fireEvent.click(screen.getByLabelText("detail.player.expandPlayerAria"))
		expect(onExpandedChange).toHaveBeenCalledWith(true)
	})

	it("opens the expanded rate menu upward by default so the mobile bottom player stays on screen", () => {
		render(<RecordingDetailAudioBar {...baseProps} expanded />)

		fireEvent.click(screen.getByTestId("recording-detail-player-rate-trigger"))
		expect(screen.getByTestId("recording-detail-player-rate-content").className).toContain(
			"bottom-full",
		)
	})

	it("opens the PC expanded rate menu downward so the workbench does not clip it", () => {
		render(<RecordingDetailAudioBar {...baseProps} expanded rateMenuPlacement="down" />)

		fireEvent.click(screen.getByTestId("recording-detail-player-rate-trigger"))
		const menu = screen.getByTestId("recording-detail-player-rate-content")
		expect(menu.className).toContain("top-full")
		expect(menu.className).not.toContain("bottom-full")
		expect(screen.getByTestId("recording-detail-audio-bar").className).toContain("z-20")
	})
})
