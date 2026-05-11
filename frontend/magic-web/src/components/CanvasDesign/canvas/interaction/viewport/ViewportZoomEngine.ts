import Konva from "konva"

export type ViewportPoint = { x: number; y: number }

export type ZoomPending = {
	scale: number
	position: ViewportPoint
}

export type ViewportSnapshot = ZoomPending

export function getViewportSnapshot(
	stage: Konva.Stage,
	pendingZoom: ZoomPending | null,
): ViewportSnapshot {
	if (pendingZoom) {
		return {
			scale: pendingZoom.scale,
			position: {
				x: pendingZoom.position.x,
				y: pendingZoom.position.y,
			},
		}
	}

	const position = stage.position()
	return {
		scale: stage.scaleX(),
		position: {
			x: position.x,
			y: position.y,
		},
	}
}

export function clampScale(scale: number, minScale: number, maxScale: number): number {
	return Math.max(minScale, Math.min(maxScale, scale))
}

export function zoomToScaleAtAnchor(
	viewport: ViewportSnapshot,
	anchor: ViewportPoint,
	nextScale: number,
): ZoomPending {
	const worldPoint = {
		x: (anchor.x - viewport.position.x) / viewport.scale,
		y: (anchor.y - viewport.position.y) / viewport.scale,
	}

	return {
		scale: nextScale,
		position: {
			x: anchor.x - worldPoint.x * nextScale,
			y: anchor.y - worldPoint.y * nextScale,
		},
	}
}

export function zoomByFactorAtAnchor(
	viewport: ViewportSnapshot,
	anchor: ViewportPoint,
	scaleFactor: number,
	minScale: number,
	maxScale: number,
): ZoomPending {
	const nextScale = clampScale(viewport.scale * scaleFactor, minScale, maxScale)
	return zoomToScaleAtAnchor(viewport, anchor, nextScale)
}

export function getWheelZoomFactor(deltaY: number): number {
	const absDelta = Math.abs(deltaY)
	if (absDelta < 10) return Math.exp(-deltaY * 0.01)
	if (absDelta < 50) return Math.exp(-deltaY * 0.005)
	return Math.exp(-deltaY * 0.002)
}

export function zoomByWheelDeltaAtAnchor(
	viewport: ViewportSnapshot,
	anchor: ViewportPoint,
	deltaY: number,
	minScale: number,
	maxScale: number,
): ZoomPending {
	return zoomByFactorAtAnchor(viewport, anchor, getWheelZoomFactor(deltaY), minScale, maxScale)
}
