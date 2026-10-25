import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"
import type { FlatColorSegment } from "../../../utils/chapter-color-segments"
import { formatRecordingTime } from "../../../utils/time"
import { StaticPeakWaveformStrip } from "./StaticPeakWaveformStrip"

/** Formats seconds as HH:MM:SS for waveform slider aria text. */
function formatHMS(sec: number): string {
	const t = Math.max(0, sec)
	const h = Math.floor(t / 3600)
	const m = Math.floor((t % 3600) / 60)
	const s = Math.floor(t % 60)
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

interface LiveAudioWaveformSeekProps {
	durationSec: number
	currentSec: number
	peakNorms: number[]
	maxBarPx: number
	paused: boolean
	onSeek: (sec: number) => void
	ariaLabel: string
	seekKeyboardStep: number
	colorSegments?: FlatColorSegment[]
}

/**
 * Interactive waveform seek control with drag, keyboard navigation, and slider semantics.
 */
export function LiveAudioWaveformSeek({
	durationSec,
	currentSec,
	peakNorms,
	maxBarPx,
	paused,
	onSeek,
	ariaLabel,
	seekKeyboardStep,
	colorSegments,
}: LiveAudioWaveformSeekProps) {
	const wrapRef = useRef<HTMLDivElement>(null)
	const draggingRef = useRef(false)
	const [optimisticSec, setOptimisticSec] = useState<number | null>(null)
	const rafSeekRef = useRef<number | null>(null)
	const latestTargetSecRef = useRef<number>(0)
	const duration = Math.max(0.001, durationSec)
	// Hovered chapter segment plus the pointer time and viewport coordinates that anchor its floating panel.
	const [hovered, setHovered] = useState<{
		segment: FlatColorSegment
		sec: number
		clientX: number
		clientY: number
	} | null>(null)

	const ratioFromClientX = useCallback((clientX: number) => {
		const el = wrapRef.current
		if (!el) return 0
		const rect = el.getBoundingClientRect()
		if (rect.width <= 0) return 0
		return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
	}, [])

	/**
	 * Updates local optimistic seek state immediately for zero-latency progress tracking,
	 * while throttling actual audio seek events via RAF using latestTargetSecRef to avoid decoder thrashing.
	 */
	const updateDragPosition = useCallback(
		(clientX: number, isFinal = false) => {
			const targetSec = ratioFromClientX(clientX) * duration
			latestTargetSecRef.current = targetSec
			setOptimisticSec(targetSec)

			if (isFinal) {
				if (rafSeekRef.current != null) {
					cancelAnimationFrame(rafSeekRef.current)
					rafSeekRef.current = null
				}
				onSeek(targetSec)
			} else {
				if (rafSeekRef.current == null) {
					rafSeekRef.current = requestAnimationFrame(() => {
						rafSeekRef.current = null
						onSeek(latestTargetSecRef.current)
					})
				}
			}
		},
		[duration, onSeek, ratioFromClientX],
	)

	/** Clean up pending RAF seek throttling on unmount. */
	useEffect(() => {
		return () => {
			if (rafSeekRef.current != null) {
				cancelAnimationFrame(rafSeekRef.current)
				rafSeekRef.current = null
			}
		}
	}, [])

	/** Clear optimistic seek lock once actual playback time catches up with the seeked position. */
	useEffect(() => {
		if (optimisticSec == null || draggingRef.current) return
		if (Math.abs(currentSec - optimisticSec) < 0.5) {
			setOptimisticSec(null)
			return
		}
		const timer = setTimeout(() => {
			if (!draggingRef.current) {
				setOptimisticSec(null)
			}
		}, 600)
		return () => clearTimeout(timer)
	}, [currentSec, optimisticSec])

	/** Tracks the chapter under the cursor for the floating name/time panel, hiding it while dragging. */
	function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
		if (draggingRef.current || !colorSegments || colorSegments.length === 0) {
			setHovered(null)
			return
		}
		const sec = ratioFromClientX(event.clientX) * duration
		const segment = colorSegments.find(
			(candidate) => sec >= candidate.start && sec <= candidate.end,
		)
		setHovered(
			segment ? { segment, sec, clientX: event.clientX, clientY: event.clientY } : null,
		)
	}

	function handleMouseLeave() {
		setHovered(null)
	}

	function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		if (event.button !== 0) return
		event.preventDefault()
		draggingRef.current = true
		setHovered(null)
		event.currentTarget.setPointerCapture(event.pointerId)
		updateDragPosition(event.clientX, false)
	}

	function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return
		event.preventDefault()
		updateDragPosition(event.clientX, false)
	}

	function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return
		draggingRef.current = false
		updateDragPosition(event.clientX, true)
		try {
			event.currentTarget.releasePointerCapture(event.pointerId)
		} catch {
			// pointer may already be released
		}
	}

	// Active display time prioritizes responsive drag/seek position during and immediately after interactions
	const activeDisplaySec = optimisticSec ?? currentSec

	return (
		<>
			<div
				ref={wrapRef}
				className="relative w-full cursor-pointer"
				style={{ height: maxBarPx, touchAction: "none" }}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				<StaticPeakWaveformStrip
					peakNorms={peakNorms}
					maxBarPx={maxBarPx}
					currentSec={activeDisplaySec}
					durationSec={durationSec}
					colorSegments={colorSegments}
					className="pointer-events-none"
				/>
				<div
					role="slider"
					aria-label={ariaLabel}
					aria-valuemin={0}
					aria-valuemax={Math.round(durationSec)}
					aria-valuenow={Math.round(activeDisplaySec)}
					aria-valuetext={`${formatHMS(activeDisplaySec)} / ${formatHMS(durationSec)}`}
					tabIndex={0}
					className="absolute inset-0 z-[1] cursor-pointer touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
					onKeyDown={(event) => {
						const step = seekKeyboardStep
						if (event.key === "ArrowRight" || event.key === "ArrowUp") {
							event.preventDefault()
							onSeek(Math.min(duration, currentSec + step))
						}
						if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
							event.preventDefault()
							onSeek(Math.max(0, currentSec - step))
						}
						if (event.key === "Home") {
							event.preventDefault()
							onSeek(0)
						}
						if (event.key === "End") {
							event.preventDefault()
							onSeek(duration)
						}
					}}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
					onLostPointerCapture={() => {
						draggingRef.current = false
					}}
				/>
			</div>
			{hovered
				? createPortal(
						<div
							className="pointer-events-none fixed z-50 max-w-[16rem] rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-md"
							style={{
								left: hovered.clientX,
								top: hovered.clientY,
								transform: "translate(12px, calc(-100% - 12px))",
							}}
							data-testid="recording-detail-waveform-chapter-tooltip"
						>
							<div className="font-medium leading-4 text-popover-foreground">
								{hovered.segment.name}
							</div>
							<div className="mt-0.5 tabular-nums leading-4 text-muted-foreground">
								{formatRecordingTime(hovered.sec)}
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	)
}
