import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/utils/cn"

interface MobileVoiceEdgeGlowProps {
	active: boolean
	audioLevel?: number
}

interface MobileVoiceEdgeGlowHotspot {
	k0: number
	drift: number
	freq: number
	phase: number
	sigma: number
	weight: number
}

interface MobileVoiceEdgeGlowRingOptions {
	width: number
	alpha: number
	inset: number
	segments: number
	t: number
	phaseShift: number
	ampSource: number
	bumpScale?: number
}

const MOBILE_VOICE_EDGE_GLOW_PALETTE = [
	{ r: 255, g: 110, b: 199 },
	{ r: 198, g: 107, b: 255 },
	{ r: 107, g: 181, b: 255 },
	{ r: 107, g: 255, b: 234 },
	{ r: 255, g: 216, b: 107 },
	{ r: 255, g: 130, b: 80 },
]

const MOBILE_VOICE_EDGE_GLOW_HOTSPOTS: MobileVoiceEdgeGlowHotspot[] = [
	{ k0: 0.04, drift: 0.013, freq: 1.3, phase: 0.7, sigma: 0.1, weight: 1.1 },
	{ k0: 0.21, drift: -0.009, freq: 1.9, phase: 2.1, sigma: 0.08, weight: 0.95 },
	{ k0: 0.39, drift: 0.016, freq: 1.1, phase: 3.5, sigma: 0.12, weight: 1.2 },
	{ k0: 0.57, drift: -0.012, freq: 2.3, phase: 4.2, sigma: 0.09, weight: 1 },
	{ k0: 0.74, drift: 0.01, freq: 1.6, phase: 5.7, sigma: 0.11, weight: 1.05 },
	{ k0: 0.88, drift: -0.014, freq: 2, phase: 6.3, sigma: 0.075, weight: 0.85 },
]

const MOBILE_VOICE_EDGE_GLOW_COLOR_DRIFT_SPEED = 0.04
const MOBILE_VOICE_EDGE_GLOW_RADIUS = 28

function addMobileVoiceEdgeGlowRoundedRectPath(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2))

	if (typeof context.roundRect === "function") {
		context.roundRect(x, y, width, height, safeRadius)
		return
	}

	context.moveTo(x + safeRadius, y)
	context.lineTo(x + width - safeRadius, y)
	context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
	context.lineTo(x + width, y + height - safeRadius)
	context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
	context.lineTo(x + safeRadius, y + height)
	context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
	context.lineTo(x, y + safeRadius)
	context.quadraticCurveTo(x, y, x + safeRadius, y)
}

function pointOnMobileVoiceEdgeGlowRect(
	position: number,
	width: number,
	height: number,
	radius: number,
	inset = 0,
) {
	const x0 = inset
	const y0 = inset
	const x1 = width - inset
	const y1 = height - inset
	const safeRadius = Math.max(0, radius - inset)

	if (safeRadius <= 0) {
		const perimeter = 2 * (x1 - x0) + 2 * (y1 - y0)
		let distance = (((position % 1) + 1) % 1) * perimeter
		if (distance < x1 - x0) return { x: x0 + distance, y: y0 }
		distance -= x1 - x0
		if (distance < y1 - y0) return { x: x1, y: y0 + distance }
		distance -= y1 - y0
		if (distance < x1 - x0) return { x: x1 - distance, y: y1 }
		distance -= x1 - x0
		return { x: x0, y: y1 - distance }
	}

	const straightTop = x1 - x0 - 2 * safeRadius
	const straightSide = y1 - y0 - 2 * safeRadius
	const arc = (Math.PI * safeRadius) / 2
	const perimeter = 2 * straightTop + 2 * straightSide + 4 * arc
	let distance = (((position % 1) + 1) % 1) * perimeter

	if (distance < straightTop) return { x: x0 + safeRadius + distance, y: y0 }
	distance -= straightTop
	if (distance < arc) {
		const angle = (distance / arc) * (Math.PI / 2) - Math.PI / 2
		return {
			x: x1 - safeRadius + Math.cos(angle) * safeRadius,
			y: y0 + safeRadius + Math.sin(angle) * safeRadius,
		}
	}
	distance -= arc
	if (distance < straightSide) return { x: x1, y: y0 + safeRadius + distance }
	distance -= straightSide
	if (distance < arc) {
		const angle = (distance / arc) * (Math.PI / 2)
		return {
			x: x1 - safeRadius + Math.cos(angle) * safeRadius,
			y: y1 - safeRadius + Math.sin(angle) * safeRadius,
		}
	}
	distance -= arc
	if (distance < straightTop) return { x: x1 - safeRadius - distance, y: y1 }
	distance -= straightTop
	if (distance < arc) {
		const angle = (distance / arc) * (Math.PI / 2) + Math.PI / 2
		return {
			x: x0 + safeRadius + Math.cos(angle) * safeRadius,
			y: y1 - safeRadius + Math.sin(angle) * safeRadius,
		}
	}
	distance -= arc
	if (distance < straightSide) return { x: x0, y: y1 - safeRadius - distance }
	distance -= straightSide
	const angle = (distance / arc) * (Math.PI / 2) + Math.PI
	return {
		x: x0 + safeRadius + Math.cos(angle) * safeRadius,
		y: y0 + safeRadius + Math.sin(angle) * safeRadius,
	}
}

function sampleMobileVoiceEdgeGlowColor(position: number, timeShift: number) {
	const colorIndex = (position + timeShift) * MOBILE_VOICE_EDGE_GLOW_PALETTE.length
	const index = Math.floor(colorIndex)
	const current =
		MOBILE_VOICE_EDGE_GLOW_PALETTE[
			((index % MOBILE_VOICE_EDGE_GLOW_PALETTE.length) +
				MOBILE_VOICE_EDGE_GLOW_PALETTE.length) %
				MOBILE_VOICE_EDGE_GLOW_PALETTE.length
		]
	const next =
		MOBILE_VOICE_EDGE_GLOW_PALETTE[
			(((index + 1) % MOBILE_VOICE_EDGE_GLOW_PALETTE.length) +
				MOBILE_VOICE_EDGE_GLOW_PALETTE.length) %
				MOBILE_VOICE_EDGE_GLOW_PALETTE.length
		]
	const mix = colorIndex - index

	return [
		current.r * (1 - mix) + next.r * mix,
		current.g * (1 - mix) + next.g * mix,
		current.b * (1 - mix) + next.b * mix,
	] as const
}

function mockMobileVoiceEdgeGlowVoiceLevel(time: number) {
	const envelope = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 0.55 + 0.3))
	const word =
		0.5 +
		0.5 * Math.sin(time * 2.3 + 1.1) * 0.7 +
		0.5 * Math.sin(time * 3.7 + 2.2) * 0.3
	const syllable =
		0.5 +
		0.5 * Math.sin(time * 7.1 + 0.6) * 0.5 +
		0.5 * Math.sin(time * 11.3 + 3.4) * 0.5
	const spike =
		Math.pow(Math.max(0, Math.sin(time * 1.9 + 0.7)), 8) * 0.7 +
		Math.pow(Math.max(0, Math.sin(time * 2.7 + 2.5)), 10) * 0.5

	return Math.min(1, Math.max(0, envelope * (0.4 + word * 0.45 + syllable * 0.25) + spike))
}

function mobileVoiceEdgeGlowSpeechAmp(time: number, position: number, ampSource: number) {
	const globalWave =
		Math.sin(time * 1.7) * 0.4 +
		Math.sin(time * 3.1) * 0.3 +
		Math.sin(time * 5.9) * 0.2
	const global = 0.5 + 0.5 * globalWave
	const localWave =
		Math.sin(time * 6.3 + position * 14.7) * 0.4 +
		Math.sin(time * 9.1 + position * 9.3) * 0.3
	const local = 0.5 + 0.5 * localWave
	const mixed = global * 0.55 + local * 0.45
	const driven = mixed * (0.45 + 0.55 * ampSource)

	return 0.18 + driven * 0.62
}

function mobileVoiceEdgeGlowHotspotBump(time: number, position: number, ampSource: number) {
	let sum = 0
	for (const hotspot of MOBILE_VOICE_EDGE_GLOW_HOTSPOTS) {
		let distance = Math.abs(
			position - ((((hotspot.k0 + time * hotspot.drift) % 1) + 1) % 1),
		)
		if (distance > 0.5) distance = 1 - distance

		const falloff = Math.exp(-(distance * distance) / (2 * hotspot.sigma * hotspot.sigma))
		const pulse = Math.pow(0.5 + 0.5 * Math.sin(time * hotspot.freq + hotspot.phase), 2)
		sum += falloff * pulse * hotspot.weight
	}

	return sum * (0.35 + 0.65 * ampSource)
}

function drawMobileVoiceEdgeGlowRing(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	radius: number,
	options: MobileVoiceEdgeGlowRingOptions,
) {
	const {
		width: lineWidth,
		alpha,
		inset,
		segments,
		t,
		phaseShift,
		ampSource,
		bumpScale = 1.5,
	} = options
	const colorShift = t * MOBILE_VOICE_EDGE_GLOW_COLOR_DRIFT_SPEED
	let previousPoint = pointOnMobileVoiceEdgeGlowRect(0, width, height, radius, inset)

	context.lineCap = "butt"
	context.lineJoin = "round"

	for (let index = 0; index < segments; index += 1) {
		const position = index / segments
		const nextPoint = pointOnMobileVoiceEdgeGlowRect(
			(index + 1) / segments,
			width,
			height,
			radius,
			inset,
		)
		const [r, g, b] = sampleMobileVoiceEdgeGlowColor(position, colorShift)
		const baseAmp = mobileVoiceEdgeGlowSpeechAmp(t, position + phaseShift, ampSource)
		const bump = mobileVoiceEdgeGlowHotspotBump(t, position, ampSource)
		const currentAlpha = Math.min(1, alpha * (baseAmp + bump * 0.55))

		context.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${currentAlpha})`
		context.lineWidth = lineWidth * (1 + bump * bumpScale)
		context.beginPath()
		context.moveTo(previousPoint.x, previousPoint.y)
		context.lineTo(nextPoint.x, nextPoint.y)
		context.stroke()

		previousPoint = nextPoint
	}
}

function clipMobileVoiceEdgeGlowCoreRing(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	radius: number,
	ringWidth: number,
) {
	context.beginPath()
	addMobileVoiceEdgeGlowRoundedRectPath(context, 0, 0, width, height, radius)
	addMobileVoiceEdgeGlowRoundedRectPath(
		context,
		ringWidth,
		ringWidth,
		width - ringWidth * 2,
		height - ringWidth * 2,
		Math.max(0, radius - ringWidth),
	)
	context.clip("evenodd")
}

function MobileVoiceEdgeGlow({ active, audioLevel }: MobileVoiceEdgeGlowProps) {
	const wrapperRef = useRef<HTMLDivElement>(null)
	const glowCanvasRef = useRef<HTMLCanvasElement>(null)
	const coreCanvasRef = useRef<HTMLCanvasElement>(null)
	const rafRef = useRef<number | null>(null)
	const activeRef = useRef(active)
	const startLoopRef = useRef<(() => void) | null>(null)
	const audioLevelRef = useRef<number | null>(typeof audioLevel === "number" ? audioLevel : null)
	const [isDark, setIsDark] = useState(false)
	const [isMounted, setIsMounted] = useState(false)
	const isDarkRef = useRef(isDark)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	useEffect(() => {
		audioLevelRef.current = typeof audioLevel === "number" ? audioLevel : null
	}, [audioLevel])

	useEffect(() => {
		if (typeof document === "undefined") return

		const documentElement = document.documentElement
		const update = () => setIsDark(documentElement.classList.contains("dark"))
		update()

		const observer = new MutationObserver(update)
		observer.observe(documentElement, { attributes: true, attributeFilter: ["class"] })
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		isDarkRef.current = isDark
	}, [isDark])

	useEffect(() => {
		activeRef.current = active
		if (active) startLoopRef.current?.()
	}, [active])

	useEffect(() => {
		if (!isMounted) return

		const wrapper = wrapperRef.current
		const glowCanvas = glowCanvasRef.current
		const coreCanvas = coreCanvasRef.current
		if (!wrapper || !glowCanvas || !coreCanvas) return

		const glowContext = glowCanvas.getContext("2d")
		const coreContext = coreCanvas.getContext("2d")
		if (!glowContext || !coreContext) return

		const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
		let width = 0
		let height = 0

		const resize = () => {
			const rect = wrapper.getBoundingClientRect()
			width = rect.width
			height = rect.height

			for (const canvas of [glowCanvas, coreCanvas]) {
				canvas.width = Math.max(1, Math.floor(width * dpr))
				canvas.height = Math.max(1, Math.floor(height * dpr))
				canvas.style.width = `${width}px`
				canvas.style.height = `${height}px`
				canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0)
			}
		}

		resize()
		const resizeObserver = new ResizeObserver(resize)
		resizeObserver.observe(wrapper)
		const start = performance.now()
		const frameInterval = 1000 / 45
		let lastDrawTime = 0
		let isVisible = document.visibilityState === "visible"

		const ensureLoop = () => {
			if (rafRef.current == null && activeRef.current && isVisible) {
				lastDrawTime = 0
				rafRef.current = requestAnimationFrame(draw)
			}
		}
		startLoopRef.current = ensureLoop

		const handleVisibilityChange = () => {
			isVisible = document.visibilityState === "visible"
			if (isVisible) ensureLoop()
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)

		const draw = (timestamp: number) => {
			if (!activeRef.current) {
				rafRef.current = null
				glowContext.clearRect(0, 0, width, height)
				coreContext.clearRect(0, 0, width, height)
				return
			}

			if (!isVisible) {
				rafRef.current = null
				return
			}

			if (timestamp - lastDrawTime < frameInterval) {
				rafRef.current = requestAnimationFrame(draw)
				return
			}
			lastDrawTime = timestamp

			const time = (timestamp - start) / 1000
			const ampSource =
				audioLevelRef.current != null
					? Math.min(1, Math.max(0, audioLevelRef.current))
					: mockMobileVoiceEdgeGlowVoiceLevel(time)
			const dark = isDarkRef.current
			const glowComposite: GlobalCompositeOperation = dark ? "lighter" : "source-over"
			const glowAlphaScale = dark ? 1 : 1.35
			const edgeWidth = 1.5
			const segments = 360
			const radius = MOBILE_VOICE_EDGE_GLOW_RADIUS

			glowContext.clearRect(0, 0, width, height)
			glowContext.globalCompositeOperation = glowComposite
			drawMobileVoiceEdgeGlowRing(glowContext, width, height, radius, {
				width: edgeWidth * 5,
				alpha: 0.4 * glowAlphaScale,
				inset: 0,
				segments,
				t: time,
				phaseShift: 0,
				ampSource,
				bumpScale: 2.2,
			})
			drawMobileVoiceEdgeGlowRing(glowContext, width, height, radius, {
				width: edgeWidth * 3,
				alpha: 0.28 * glowAlphaScale,
				inset: 0,
				segments,
				t: time,
				phaseShift: 0.37,
				ampSource,
				bumpScale: 1.8,
			})

			coreContext.clearRect(0, 0, width, height)
			coreContext.save()
			clipMobileVoiceEdgeGlowCoreRing(
				coreContext,
				width,
				height,
				radius,
				edgeWidth + 2,
			)
			coreContext.globalCompositeOperation = "source-over"
			drawMobileVoiceEdgeGlowRing(coreContext, width, height, radius, {
				width: edgeWidth * 2.2,
				alpha: 0.85 * (dark ? 1 : 1.15),
				inset: edgeWidth / 2,
				segments,
				t: time,
				phaseShift: 0,
				ampSource,
				bumpScale: 0.6,
			})
			coreContext.restore()

			rafRef.current = requestAnimationFrame(draw)
		}

		ensureLoop()

		return () => {
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
			rafRef.current = null
			startLoopRef.current = null
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			resizeObserver.disconnect()
		}
	}, [isMounted])

	if (!isMounted) return null

	return createPortal(
		<div
			ref={wrapperRef}
			className={cn(
				"pointer-events-none fixed inset-0 z-[60] transition-opacity duration-500",
				active ? "opacity-100" : "opacity-0",
			)}
			style={{
				borderRadius: MOBILE_VOICE_EDGE_GLOW_RADIUS,
				overflow: "hidden",
			}}
			aria-hidden
			data-testid="mobile-composer-voice-edge-glow"
		>
			<canvas
				ref={glowCanvasRef}
				className={cn(
					"absolute inset-0 size-full",
					isDark ? "blur-[8px] opacity-[0.85]" : "blur-[5px]",
				)}
				style={{ willChange: "filter, opacity" }}
				data-testid="mobile-voice-edge-glow-canvas"
			/>
			<canvas
				ref={coreCanvasRef}
				className="absolute inset-0 size-full blur-[0.8px]"
				style={{ willChange: "filter, opacity" }}
				data-testid="mobile-voice-edge-glow-canvas-2"
			/>
		</div>,
		document.body,
	)
}

export default MobileVoiceEdgeGlow
