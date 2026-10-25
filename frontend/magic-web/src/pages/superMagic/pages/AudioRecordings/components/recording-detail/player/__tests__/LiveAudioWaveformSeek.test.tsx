import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LiveAudioWaveformSeek } from "../LiveAudioWaveformSeek"
import type { FlatColorSegment } from "../../../utils/chapter-color-segments"

const SEGMENTS: FlatColorSegment[] = [
	{ start: 0, end: 50, color: "#112233", name: "Opening" },
	{ start: 50, end: 100, color: "#445566", name: "Closing" },
]

/** Gives the waveform wrap a stable 0..100 width so clientX maps 1:1 to playback seconds. */
function mockWaveformRect() {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		left: 0,
		width: 100,
		right: 100,
		top: 0,
		bottom: 20,
		height: 20,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	} as unknown as DOMRect)
}

function renderWaveform(colorSegments?: FlatColorSegment[]) {
	return render(
		<LiveAudioWaveformSeek
			durationSec={100}
			currentSec={0}
			peakNorms={[0.5, 0.5, 0.5]}
			maxBarPx={20}
			paused={false}
			onSeek={vi.fn()}
			ariaLabel="waveform"
			seekKeyboardStep={5}
			colorSegments={colorSegments}
		/>,
	)
}

describe("LiveAudioWaveformSeek", () => {
	it("seeks when arrow keys are pressed", () => {
		const onSeek = vi.fn()
		render(
			<LiveAudioWaveformSeek
				durationSec={120}
				currentSec={30}
				peakNorms={[0.3, 0.7, 0.5]}
				maxBarPx={20}
				paused={false}
				onSeek={onSeek}
				ariaLabel="seek"
				seekKeyboardStep={15}
			/>,
		)

		const slider = screen.getByRole("slider", { name: "seek" })
		fireEvent.keyDown(slider, { key: "ArrowRight" })
		expect(onSeek).toHaveBeenCalledWith(45)
	})

	describe("chapter hover panel", () => {
		beforeEach(() => {
			mockWaveformRect()
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("shows the hovered chapter name and current pointer time", () => {
			renderWaveform(SEGMENTS)

			fireEvent.mouseMove(screen.getByRole("slider", { name: "waveform" }), {
				clientX: 25,
				clientY: 10,
			})

			const tooltip = screen.getByTestId("recording-detail-waveform-chapter-tooltip")
			expect(tooltip).toHaveTextContent("Opening")
			expect(tooltip).toHaveTextContent("00:25")
		})

		it("switches to the chapter under the cursor", () => {
			renderWaveform(SEGMENTS)

			fireEvent.mouseMove(screen.getByRole("slider", { name: "waveform" }), {
				clientX: 75,
				clientY: 10,
			})

			expect(
				screen.getByTestId("recording-detail-waveform-chapter-tooltip"),
			).toHaveTextContent("Closing")
		})

		it("does not render a panel when no color segments are provided", () => {
			renderWaveform(undefined)

			fireEvent.mouseMove(screen.getByRole("slider", { name: "waveform" }), {
				clientX: 25,
				clientY: 10,
			})

			expect(
				screen.queryByTestId("recording-detail-waveform-chapter-tooltip"),
			).not.toBeInTheDocument()
		})
	})
})
