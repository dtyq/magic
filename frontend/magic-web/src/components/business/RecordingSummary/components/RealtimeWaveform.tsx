import { memo, useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { logger as Logger } from "@/utils/log"
import { getServiceInstance } from "@/services/recordSummary/serviceInstance"

interface RealtimeWaveformProps {
	isRecording: boolean
	isPaused: boolean
	width?: number
	height?: number
	onAudioLevelChange?: (level: number) => void
}

// Configuration constants - based on MDN Web Audio API tutorial
const CONFIG = {
	// Canvas dimensions
	CANVAS_WIDTH: 400,
	CANVAS_HEIGHT: 50,
	// For frequency analysis - following MDN tutorial approach
	FFT_SIZE: 256, // This will give us 128 frequency bins
	SMOOTHING_TIME_CONSTANT: 0.8,
	MIN_DECIBELS: -90,
	MAX_DECIBELS: -10,
	// Waveform visual settings
	MIN_BAR_HEIGHT_RATIO: 0.02, // Minimum bar height as percentage of canvas height
} as const

// Color configuration - matching Figma design
const COLORS = {
	PRIMARY: "#315CEC", // Red/coral color from design
	BACKGROUND: "transparent",
	// Red gradient colors for bars
	BAR_RED: 49, // Red component
	BAR_GREEN: 92, // Green component for coral effect
	BAR_BLUE: 236, // Blue component for coral effect
} as const

const logger = Logger.createLogger("RealtimeWaveform", {
	enableConfig: { console: false },
})

function RealtimeWaveform({
	isRecording = false,
	isPaused = false,
	width = CONFIG.CANVAS_WIDTH,
	height = CONFIG.CANVAS_HEIGHT,
	onAudioLevelChange,
}: RealtimeWaveformProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const animationFrameRef = useRef<number>()

	// Store latest isRecording state to avoid closure trap
	const isRecordingRef = useRef<boolean>(isRecording)

	// Render minimum height bars when paused
	const renderMinimumBars = useMemoizedFn(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		if (!ctx) return

		// Set canvas size with device pixel ratio
		const dpr = window.devicePixelRatio || 1
		canvas.width = width * dpr
		canvas.height = height * dpr
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`

		ctx.scale(dpr, dpr)

		// Clear background completely
		ctx.clearRect(0, 0, width, height)

		// Calculate bar properties
		const barCount = 64 // Fixed number of bars for consistent look
		const barWidth = Math.max(1, (width / barCount) * 0.5) // Same width calculation as active state
		const barSpacing = 1

		// Calculate center positions
		const centerX = width / 2
		const centerY = height / 2
		const minBarHeight = height * CONFIG.MIN_BAR_HEIGHT_RATIO

		ctx.globalAlpha = 0.3 // Lower opacity for paused state

		// Set color for minimum bars
		ctx.fillStyle = `rgb(${COLORS.BAR_RED}, ${COLORS.BAR_GREEN}, ${COLORS.BAR_BLUE})`

		// Draw right side minimum bars
		let rightX = centerX + barSpacing / 2
		for (let i = 0; i < barCount; i++) {
			// Draw main bar from center up (right side)
			const mainBarY = centerY - minBarHeight
			ctx.fillRect(rightX, mainBarY, barWidth, minBarHeight)

			// Draw reflection bar from center down (right side)
			ctx.fillRect(rightX, centerY, barWidth, minBarHeight)

			rightX += barWidth + barSpacing
		}

		// Draw left side minimum bars (mirror)
		let leftX = centerX - barWidth - barSpacing / 2
		for (let i = 0; i < barCount; i++) {
			// Draw main bar from center up (left side)
			const mainBarY = centerY - minBarHeight
			ctx.fillRect(leftX, mainBarY, barWidth, minBarHeight)

			// Draw reflection bar from center down (left side)
			ctx.fillRect(leftX, centerY, barWidth, minBarHeight)

			leftX -= barWidth + barSpacing
		}

		ctx.globalAlpha = 1
	})

	// Render frequency bars using data from service's shared AnalyserNode
	const renderFrequencyBars = useMemoizedFn(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		if (!ctx) return

		// Set canvas size with device pixel ratio
		const dpr = window.devicePixelRatio || 1
		canvas.width = width * dpr
		canvas.height = height * dpr
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`

		ctx.scale(dpr, dpr)

		let dataArray: Uint8Array
		let bufferLength: number

		// Get frequency data from service's shared AnalyserNode
		const service = getServiceInstance()
		const frequencyData = service?.getFrequencyData()

		if (isRecordingRef.current && frequencyData) {
			// Get real-time frequency data from service
			const currentDataArray = frequencyData

			// Transform frequency data to create descending slope pattern like Figma design
			const transformedData = new Uint8Array(currentDataArray.length)
			for (let i = 0; i < currentDataArray.length; i++) {
				const normalizedPosition = i / currentDataArray.length
				const slopeMultiplier = 1 - normalizedPosition * 0.7 // Gradual decrease from left to right

				// Boost low-to-mid frequencies for better visual impact
				let frequencyValue = currentDataArray[i]
				if (normalizedPosition < 0.6) {
					frequencyValue = Math.min(255, frequencyValue * 1.3)
				}

				transformedData[i] = Math.floor(frequencyValue * slopeMultiplier)
			}

			dataArray = transformedData
			bufferLength = dataArray.length

			// Calculate audio level for callback
			const sum = dataArray.reduce((acc, val) => acc + val, 0)
			const averageLevel = sum / bufferLength / 255
			onAudioLevelChange?.(averageLevel)
		} else {
			return
		}

		// Clear background completely to prevent flickering
		ctx.clearRect(0, 0, width, height)

		// Calculate bar width for clean visual spacing - reduced by 1/3
		const barWidth = Math.max(1, (width / bufferLength) * 1.47 * 0.5) // Reduced width for left-right mirroring
		const barSpacing = 1 // Small gap between bars

		// Calculate center positions for perfect mirroring
		const centerX = width / 2 // Canvas horizontal center line
		const centerY = height / 2 // Canvas vertical center line
		const waveformHeight = height * 0.45 // Each part (main and reflection) takes 45% of canvas height
		const minBarHeight = height * CONFIG.MIN_BAR_HEIGHT_RATIO

		const targetAlpha = isRecordingRef.current ? 0.9 : 0.6
		ctx.globalAlpha = targetAlpha

		// Draw right side (original waveform from center to right)
		let rightX = centerX + barSpacing / 2 // Start slightly right of center to avoid overlap
		for (let i = 0; i < bufferLength; i++) {
			// Calculate bar height with better scaling for visual impact
			const normalizedValue = dataArray[i] / 255
			const audioBarHeight = normalizedValue * waveformHeight
			// Ensure minimum bar height for visual consistency
			const barHeight = Math.max(minBarHeight, audioBarHeight)

			// Create gradient effect: slightly lighter on left, darker on right
			const positionRatio = i / bufferLength
			const redIntensity = COLORS.BAR_RED - positionRatio * 20 // Slight darkening
			const greenIntensity = COLORS.BAR_GREEN - positionRatio * 10
			const blueIntensity = COLORS.BAR_BLUE - positionRatio * 10

			// Set coral/red color matching Figma design
			ctx.fillStyle = `rgb(${Math.floor(redIntensity)}, ${Math.floor(
				greenIntensity,
			)}, ${Math.floor(blueIntensity)})`

			// Draw main bar from center up (right side)
			const mainBarY = centerY - barHeight
			ctx.fillRect(rightX, mainBarY, barWidth, barHeight)

			// Draw reflection bar from center down (right side)
			ctx.fillRect(rightX, centerY, barWidth, barHeight)

			rightX += barWidth + barSpacing
		}

		// Draw left side (perfect mirror from center to left)
		let leftX = centerX - barWidth - barSpacing / 2 // Start slightly left of center to avoid overlap
		for (let i = 0; i < bufferLength; i++) {
			// Use same data array for perfect mirroring
			const normalizedValue = dataArray[i] / 255
			const audioBarHeight = normalizedValue * waveformHeight
			// Ensure minimum bar height for visual consistency
			const barHeight = Math.max(minBarHeight, audioBarHeight)

			// Mirror the gradient effect: for left side, reverse the position ratio
			const positionRatio = i / bufferLength
			const redIntensity = COLORS.BAR_RED - positionRatio * 20
			const greenIntensity = COLORS.BAR_GREEN - positionRatio * 10
			const blueIntensity = COLORS.BAR_BLUE - positionRatio * 10

			// Set same coral/red color for perfect mirroring
			ctx.fillStyle = `rgb(${Math.floor(redIntensity)}, ${Math.floor(
				greenIntensity,
			)}, ${Math.floor(blueIntensity)})`

			// Draw main bar from center up (left side mirror)
			const mainBarY = centerY - barHeight
			ctx.fillRect(leftX, mainBarY, barWidth, barHeight)

			// Draw reflection bar from center down (left side mirror)
			ctx.fillRect(leftX, centerY, barWidth, barHeight)

			leftX -= barWidth + barSpacing // Move left for next bar
		}

		ctx.globalAlpha = 1
	})

	// Stable animation function using ref to get latest state
	const animate = useMemoizedFn(() => {
		// Stop animation if not recording or if paused
		if (!isRecordingRef.current || isPaused) {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = undefined
			}
			return
		}

		renderFrequencyBars()

		// Continue animation loop
		if (isRecordingRef.current && !isPaused) {
			animationFrameRef.current = requestAnimationFrame(animate)
		}
	})

	// Sync isRecording state to ref
	useEffect(() => {
		isRecordingRef.current = isRecording
	}, [isRecording])

	// Handle recording state changes - simplified without AudioContext initialization
	useEffect(() => {
		if (isRecording && !isPaused) {
			// Start animation when recording and not paused
			if (!animationFrameRef.current) {
				logger.log("Starting waveform animation")
				animate()
			}
		} else {
			// Stop animation when paused or stopped
			if (animationFrameRef.current) {
				logger.log("Stopping waveform animation")
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = undefined
			}
		}
	}, [isRecording, isPaused, animate])

	// Handle paused state changes
	useEffect(() => {
		if (isPaused) {
			// Render minimum bars when paused, regardless of recording state
			renderMinimumBars()
		} else if (!isPaused && isRecording && !animationFrameRef.current) {
			// Resume animation when unpaused and still recording
			animate()
		}
	}, [isPaused, isRecording, renderMinimumBars, animate])

	// Cleanup on unmount - simplified without AudioContext cleanup
	useEffect(() => {
		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = undefined
			}
		}
	}, [])

	// Don't render if not recording and not paused
	if (!isRecording && !isPaused) {
		return null
	}

	return (
		<div
			className="relative flex h-[50px] w-full max-w-[400px] items-center justify-center overflow-hidden bg-transparent"
			style={{ height: `${CONFIG.CANVAS_HEIGHT}px`, maxWidth: `${CONFIG.CANVAS_WIDTH}px` }}
		>
			<canvas
				ref={canvasRef}
				className="h-full w-full bg-transparent"
				width={width}
				height={height}
			/>
		</div>
	)
}

export default memo(RealtimeWaveform)
