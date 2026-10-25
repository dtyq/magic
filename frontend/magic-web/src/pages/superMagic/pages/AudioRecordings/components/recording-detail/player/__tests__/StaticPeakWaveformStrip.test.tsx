import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StaticPeakWaveformStrip } from "../StaticPeakWaveformStrip"

describe("StaticPeakWaveformStrip", () => {
	it("renders gray baseline bars and theme-colored played overlay bars", () => {
		const { container } = render(
			<StaticPeakWaveformStrip
				peakNorms={[0.2, 0.8, 0.5, 0.9]}
				maxBarPx={20}
				currentSec={50}
				durationSec={100}
			/>,
		)

		// Renders 4 unplayed gray bars and 4 theme-colored overlay bars
		expect(container.querySelectorAll(".bg-muted-foreground\\/45")).toHaveLength(4)
		expect(container.querySelectorAll(".bg-primary")).toHaveLength(4)
	})

	it("renders topic segment colors on played overlay bars when colorSegments are provided", () => {
		const segments = [
			{ start: 0, end: 50, color: "#112233", name: "Topic 1" },
			{ start: 50, end: 100, color: "#445566", name: "Topic 2" },
		]
		const { container } = render(
			<StaticPeakWaveformStrip
				peakNorms={[0.2, 0.8, 0.5, 0.9]}
				maxBarPx={20}
				currentSec={50}
				durationSec={100}
				colorSegments={segments}
			/>,
		)

		const playedBars = container.querySelectorAll("div[style*='clip-path'] span.shrink-0")
		expect(playedBars).toHaveLength(4)
		expect((playedBars[0] as HTMLElement).style.backgroundColor).toBe("rgb(17, 34, 51)")
		expect((playedBars[1] as HTMLElement).style.backgroundColor).toBe("rgb(17, 34, 51)")
		expect((playedBars[2] as HTMLElement).style.backgroundColor).toBe("rgb(68, 85, 102)")
		expect((playedBars[3] as HTMLElement).style.backgroundColor).toBe("rgb(68, 85, 102)")
	})

	it("renders compact progress indicator dot with black outer and white inner circles at the current progress", () => {
		const { rerender } = render(
			<StaticPeakWaveformStrip
				peakNorms={[0.2, 0.8, 0.5]}
				maxBarPx={52}
				currentSec={50}
				durationSec={100}
			/>,
		)

		const dot = screen.getByTestId("waveform-progress-dot")
		expect(dot).toBeInTheDocument()
		expect(dot.style.left).toBe("50%")
		expect(dot.style.width).toBe("8px")
		expect(dot.style.height).toBe("8px")
		const innerDot = dot.querySelector("span")
		expect(innerDot).toHaveClass("bg-background")
		expect(innerDot?.style.width).toBe("4px")
		expect(innerDot?.style.height).toBe("4px")

		// Collapsed player also retains consistent 8px outer and 4px inner dimensions
		rerender(
			<StaticPeakWaveformStrip
				peakNorms={[0.2, 0.8, 0.5]}
				maxBarPx={15}
				currentSec={25}
				durationSec={100}
			/>,
		)
		const collapsedDot = screen.getByTestId("waveform-progress-dot")
		expect(collapsedDot.style.left).toBe("25%")
		expect(collapsedDot.style.width).toBe("8px")
		expect(collapsedDot.style.height).toBe("8px")
		const collapsedInnerDot = collapsedDot.querySelector("span")
		expect(collapsedInnerDot?.style.width).toBe("4px")
		expect(collapsedInnerDot?.style.height).toBe("4px")
	})

	it("does not render progress dot when duration is 0", () => {
		render(
			<StaticPeakWaveformStrip
				peakNorms={[0.2, 0.8, 0.5]}
				maxBarPx={52}
				currentSec={0}
				durationSec={0}
			/>,
		)

		expect(screen.queryByTestId("waveform-progress-dot")).not.toBeInTheDocument()
	})
})
