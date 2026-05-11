import Konva from "konva"
import type { ViewportPoint, ViewportSnapshot } from "./ViewportZoomEngine"

export type PanPosition = ViewportPoint

export type WebKitGestureEventLike = Event & {
	scale?: number
	clientX?: number
	clientY?: number
}

export type WebKitGesturePinchState = {
	viewport: ViewportSnapshot
	anchor: ViewportPoint
	initialGestureScale: number
}

export const WEBKIT_GESTURE_EVENTS = [
	"gesturestart",
	"gesturechange",
	"gestureend",
	"gesturecancel",
] as const

export function getContainerRelativePoint(
	stage: Konva.Stage,
	clientX: number,
	clientY: number,
): ViewportPoint {
	const rect = stage.container().getBoundingClientRect()
	let x = clientX - rect.left
	let y = clientY - rect.top

	// Safari 在某些捏合帧里可能给出 0,0，回退到已有 pointer 或容器中心。
	if (x === 0 && y === 0) {
		const pointer = stage.getPointerPosition()
		if (pointer) {
			x = pointer.x
			y = pointer.y
		} else {
			x = rect.width / 2
			y = rect.height / 2
		}
	}

	return { x, y }
}

export function createWebKitGesturePinchState(
	stage: Konva.Stage,
	event: WebKitGestureEventLike,
	viewport: ViewportSnapshot,
): WebKitGesturePinchState {
	return {
		viewport,
		anchor: getContainerRelativePoint(stage, event.clientX ?? 0, event.clientY ?? 0),
		initialGestureScale: event.scale != null && event.scale > 0 ? event.scale : 1,
	}
}

export function getWebKitGestureScaleFactor(
	event: WebKitGestureEventLike,
	state: WebKitGesturePinchState,
): number {
	const scale = event.scale != null && event.scale > 0 ? event.scale : state.initialGestureScale
	return scale / state.initialGestureScale
}

export function offsetPanPosition(
	position: PanPosition,
	deltaX: number,
	deltaY: number,
): PanPosition {
	return {
		x: position.x - deltaX,
		y: position.y - deltaY,
	}
}

export function getTouchDistance(touch1: Touch, touch2: Touch): number {
	const dx = touch1.clientX - touch2.clientX
	const dy = touch1.clientY - touch2.clientY
	return Math.sqrt(dx * dx + dy * dy)
}

export function getTouchCenter(stage: Konva.Stage, touch1: Touch, touch2: Touch): ViewportPoint {
	const rect = stage.container().getBoundingClientRect()
	return {
		x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
		y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
	}
}
