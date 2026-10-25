import { useMemo } from "react"
import type { FlatColorSegment } from "../../../utils/chapter-color-segments"

interface StaticPeakWaveformStripProps {
	peakNorms: number[]
	maxBarPx: number
	currentSec: number
	durationSec: number
	className?: string
	colorSegments?: FlatColorSegment[]
}

/**
 * Renders simulated peak bars with topic-theme-colored played progress and a compact playhead indicator.
 * Unplayed bars use light gray, played bars use their respective topic segment colors,
 * and a compact progress dot (black outer circle, white inner center) marks the playhead.
 */
export function StaticPeakWaveformStrip({
	peakNorms,
	maxBarPx,
	currentSec,
	durationSec,
	className,
	colorSegments,
}: StaticPeakWaveformStripProps) {
	const safeDur = durationSec > 0 && Number.isFinite(durationSec) ? durationSec : 0
	const progress = safeDur > 0 ? Math.min(1, Math.max(0, currentSec / safeDur)) : 0
	const clipRightPct = (1 - progress) * 100
	const totalBars = peakNorms.length

	const barHeightsPx = useMemo(
		() =>
			peakNorms.map((norm) =>
				Math.max(2, Math.min(maxBarPx, 2 + norm * Math.max(2, maxBarPx - 2))),
			),
		[peakNorms, maxBarPx],
	)

	// Map each bar to its corresponding topic theme color if chapter segments are provided
	const barColors = useMemo(() => {
		if (!colorSegments || colorSegments.length === 0 || safeDur <= 0 || totalBars === 0) {
			return null
		}
		return peakNorms.map((_, index) => {
			const barTime = ((index + 0.5) / totalBars) * safeDur
			const segment =
				colorSegments.find(
					(candidate) => barTime >= candidate.start && barTime <= candidate.end,
				) ?? colorSegments[0]
			return segment?.color
		})
	}, [colorSegments, safeDur, peakNorms, totalBars])

	const hasColorLine = colorSegments && colorSegments.length > 0 && safeDur > 0

	return (
		<div
			className={className}
			style={{ position: "relative", height: maxBarPx, width: "100%" }}
		>
			{/* Gray baseline for unplayed audio */}
			<div className="absolute inset-0 flex items-center justify-stretch gap-0">
				{barHeightsPx.map((height, index) => (
					<div key={index} className="flex min-w-0 flex-1 items-center justify-center">
						<span
							className="shrink-0 bg-muted-foreground/45"
							style={{ width: 1, height }}
						/>
					</div>
				))}
			</div>

			{/* Topic-colored overlay for the played portion */}
			<div
				className="pointer-events-none absolute inset-0 overflow-hidden"
				style={{ clipPath: `inset(0 ${clipRightPct}% 0 0)` }}
			>
				<div className="absolute inset-0 flex items-center justify-stretch gap-0">
					{barHeightsPx.map((height, index) => {
						const color = barColors ? barColors[index] : undefined
						return (
							<div
								key={index}
								className="flex min-w-0 flex-1 items-center justify-center"
							>
								<span
									className={color ? "shrink-0" : "shrink-0 bg-primary"}
									style={{
										width: 1,
										height,
										backgroundColor: color,
									}}
								/>
							</div>
						)
					})}
				</div>
			</div>

			{/* Center chapter/speaker color segments */}
			{hasColorLine ? (
				<div
					className="pointer-events-none absolute left-0 right-0"
					style={{ top: "50%", transform: "translateY(-50%)", height: 2 }}
				>
					{/* Subtle gray base line — colored topic segments overlay in their time ranges. */}
					<div
						className="absolute inset-0"
						style={{
							background:
								"color-mix(in oklch, rgb(var(--muted-foreground-rgb)) 25%, transparent)",
						}}
					/>
					{colorSegments.map((segment, index) => {
						const left = (segment.start / safeDur) * 100
						const width = ((segment.end - segment.start) / safeDur) * 100
						if (width <= 0) return null
						return (
							<div
								key={index}
								className="absolute top-0 h-full"
								style={{
									left: `${left}%`,
									width: `${width}%`,
									background: segment.color,
								}}
							/>
						)
					})}
				</div>
			) : null}

			{/* Playback progress indicator dot (black outer circle, white inner center).
			    Use even dimensions (8px outer, 4px inner) across both expanded and collapsed
			    states to ensure symmetric integer padding (2px on all sides) and avoid subpixel
			    centering distortions. */}
			{safeDur > 0 ? (
				<div
					className="pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-foreground shadow-sm will-change-transform"
					style={{
						left: `${progress * 100}%`,
						top: "50%",
						transform: "translate3d(-50%, -50%, 0)",
						width: 8,
						height: 8,
					}}
					data-testid="waveform-progress-dot"
				>
					<span
						className="rounded-full bg-background"
						style={{
							width: 4,
							height: 4,
						}}
					/>
				</div>
			) : null}
		</div>
	)
}
