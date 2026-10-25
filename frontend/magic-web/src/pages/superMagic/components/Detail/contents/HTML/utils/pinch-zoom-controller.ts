import type { PinchPhase, PinchPoint } from "./touch-pinch"

export interface PinchAnchor {
	contentX: number
	contentY: number
	clientX: number
	clientY: number
}

interface PinchZoomControllerConfig {
	iframe: HTMLIFrameElement
	getScale: () => number
	onScaleChange: (scale: number, anchor: PinchAnchor) => void
	onActiveChange: (active: boolean) => void
}

/** One physical gesture owns its anchor and at most one pending paint update. */
export function createPinchZoomController({
	iframe,
	getScale,
	onScaleChange: changeScale,
	onActiveChange: setActive,
}: PinchZoomControllerConfig) {
	let session: {
		source: "host" | "iframe"
		ids: number[]
		distance: number
		scale: number
		anchor: PinchAnchor
		screenCenter?: { x: number; y: number }
		lastDistance: number
		lastCenter: { x: number; y: number }
	} | null = null
	let pending: { scale: number; anchor: PinchAnchor } | null = null
	let frameScheduled = false
	let frameId = 0
	let frameEpoch = 0
	const cancelFrame = () => {
		frameEpoch += 1
		if (frameScheduled) cancelAnimationFrame(frameId)
		frameScheduled = false
	}
	const flush = () => {
		frameScheduled = false
		const next = pending
		pending = null
		if (session && next) changeScale(next.scale, next.anchor)
	}
	const handleGesture = (source: "host" | "iframe", phase: PinchPhase, points: PinchPoint[]) => {
		if (phase === "end" || phase === "cancel") {
			if (session?.source === source) {
				cancelFrame()
				// A quick release keeps the final valid move; cancellation never applies queued work.
				if (phase === "end") flush()
				pending = null
				session = null
				setActive(false)
			}
			return
		}

		if (points.length !== 2) return
		if (session && session.source !== source) return
		if (phase === "start" && session) return
		const rect = iframe.getBoundingClientRect()
		// The first sample maps iframe CSS pixels into the host viewport. Native screen
		// coordinates then own relative distance/movement, independently of later transforms.
		const physicalPoints =
			source === "host"
				? points
				: points.map((point) => ({
						...point,
						x: rect.left + point.x * (rect.width / iframe.clientWidth),
						y: rect.top + point.y * (rect.height / iframe.clientHeight),
					}))
		const [a, b] = physicalPoints
		let distance = Math.hypot(a.x - b.x, a.y - b.y)
		if (!Number.isFinite(distance) || distance <= 0) return
		let clientX = (a.x + b.x) / 2
		let clientY = (a.y + b.y) / 2
		const screen = getScreenGeometry(points)
		if (screen && (phase === "start" || session?.screenCenter)) {
			distance = screen.distance
			if (session?.screenCenter) {
				clientX = session.anchor.clientX + screen.x - session.screenCenter.x
				clientY = session.anchor.clientY + screen.y - session.screenCenter.y
			}
		}
		if (phase === "start") {
			setActive(true)
			const scale = getScale()
			session = {
				source,
				ids: points.map((point) => point.id),
				distance,
				scale,
				screenCenter: screen,
				lastDistance: distance,
				lastCenter: { x: clientX, y: clientY },
				anchor: {
					contentX: (clientX - rect.left) / scale,
					contentY: (clientY - rect.top) / scale,
					clientX,
					clientY,
				},
			}
		} else if (
			session?.source === source &&
			points.every((point) => session?.ids.includes(point.id))
		) {
			// Filter distance and center independently: an intentional pan must not publish
			// tiny scale noise, and an intentional zoom must not publish center jitter.
			const distanceChanged = Math.abs(distance - session.lastDistance) > 2
			const centerChanged =
				Math.hypot(clientX - session.lastCenter.x, clientY - session.lastCenter.y) > 2
			if (!distanceChanged && !centerChanged) return
			if (distanceChanged) session.lastDistance = distance
			if (centerChanged) session.lastCenter = { x: clientX, y: clientY }
			pending = {
				scale: (session.scale * session.lastDistance) / session.distance,
				anchor: {
					...session.anchor,
					clientX: session.lastCenter.x,
					clientY: session.lastCenter.y,
				},
			}

			// Iframe messages/touch events may arrive faster than paint. Commit only the latest
			// sample in a frame rather than showing intermediate scales and scroll positions.
			if (!frameScheduled) {
				frameScheduled = true
				const epoch = frameEpoch
				frameId = requestAnimationFrame(() => {
					if (epoch === frameEpoch) flush()
				})
			}
		}
	}
	return {
		handleGesture,
		destroy: () => {
			cancelFrame()
			pending = null
			session = null
			setActive(false)
		},
	}
}

/** Delayed iframe messages carry CSS coordinates from an older transform. The screen
 * distance and movement are independent of that transform, so they cannot feed zoom back into itself. */
function getScreenGeometry(points: PinchPoint[]) {
	const [a, b] = points
	const ax = a.screenX,
		ay = a.screenY,
		bx = b.screenX,
		by = b.screenY
	if (
		typeof ax !== "number" ||
		typeof ay !== "number" ||
		typeof bx !== "number" ||
		typeof by !== "number"
	)
		return
	const distance = Math.hypot(ax - bx, ay - by)
	if (!Number.isFinite(distance) || distance <= 0) return
	return { distance, x: ax / 2 + bx / 2, y: ay / 2 + by / 2 }
}
