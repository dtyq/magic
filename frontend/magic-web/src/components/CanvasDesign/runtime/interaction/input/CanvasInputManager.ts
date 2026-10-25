import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { resolveManagedElementIdFromKonvaNode } from "../transform/elementNodeUtils"
import { getNameLabelElementIdFromNode } from "../labels/nameLabelNodeUtils"
import type {
	CanvasInputEventType,
	CanvasInputModifiers,
	CanvasInputPoint,
	CanvasNativePointerEvent,
	CanvasPointerInput,
	CanvasPointerInputHandler,
	CanvasPointerType,
} from "./types"

const LONG_PRESS_DELAY_MS = 500
const LONG_PRESS_MOVE_THRESHOLD = 8
const FALLBACK_MOUSE_SUPPRESSION_MS = 700
const FALLBACK_MOUSE_SUPPRESSION_DISTANCE = 25

type ListenerMap = Map<CanvasInputEventType, Set<CanvasPointerInputHandler>>

type LongPressState = {
	pointerId: number
	client: CanvasInputPoint
	elementId: string
	timer: ReturnType<typeof setTimeout>
}

type RecentTouchState = {
	client: CanvasInputPoint
	time: number
}

const POINTER_EVENT_NAMES = {
	down: "pointerdown",
	move: "pointermove",
	up: "pointerup",
	cancel: "pointercancel",
} as const

const FALLBACK_EVENT_NAMES = {
	down: "mousedown touchstart",
	move: "mousemove touchmove",
	up: "mouseup touchend",
	cancel: "touchcancel",
} as const

export function getClientPointFromNativeEvent(
	event: CanvasNativePointerEvent,
): CanvasInputPoint | null {
	if ("changedTouches" in event) {
		const touch = event.changedTouches[0] ?? event.touches[0]
		if (!touch) return null
		return { x: touch.clientX, y: touch.clientY }
	}

	return { x: event.clientX, y: event.clientY }
}

export function isPrimaryButtonActive(event: CanvasNativePointerEvent): boolean {
	if ("touches" in event) {
		return event.touches.length > 0
	}
	return (event.buttons & 1) === 1
}

function getPointerType(event: CanvasNativePointerEvent): CanvasPointerType {
	if ("pointerType" in event) {
		if (event.pointerType === "pen") return "pen"
		if (event.pointerType === "touch") return "touch"
		return "mouse"
	}
	if ("changedTouches" in event) return "touch"
	return "mouse"
}

function getPointerId(event: CanvasNativePointerEvent, fallbackPointerId?: number): number {
	if ("pointerId" in event) return event.pointerId
	if ("changedTouches" in event) {
		return event.changedTouches[0]?.identifier ?? event.touches[0]?.identifier ?? 1
	}
	return fallbackPointerId ?? 1
}

function getButton(event: CanvasNativePointerEvent): number {
	if ("changedTouches" in event) return 0
	return event.button
}

function getButtons(event: CanvasNativePointerEvent, type: CanvasInputEventType): number {
	if ("touches" in event) {
		return type === "up" || type === "cancel" ? 0 : event.touches.length > 0 ? 1 : 0
	}
	return event.buttons
}

function getModifiers(event: CanvasNativePointerEvent): CanvasInputModifiers {
	return {
		shift: event.shiftKey,
		alt: event.altKey,
		meta: event.metaKey,
		ctrl: event.ctrlKey,
	}
}

function supportsPointerEvents(): boolean {
	return typeof window !== "undefined" && "PointerEvent" in window
}

function isTouchEvent(event: CanvasNativePointerEvent): event is TouchEvent {
	return "changedTouches" in event
}

export class CanvasInputManager {
	private canvas: Canvas
	private listeners: ListenerMap = new Map()
	private activePointerIds = new Set<number>()
	private readonly usePointerEvents = supportsPointerEvents()
	private longPressState: LongPressState | null = null
	private recentTouchState: RecentTouchState | null = null

	private handlers: Record<CanvasInputEventType, (event: Konva.KonvaEventObject<Event>) => void> =
		{
			down: (event) => this.handleKonvaInput("down", event),
			move: (event) => this.handleKonvaInput("move", event),
			up: (event) => this.handleKonvaInput("up", event),
			cancel: (event) => this.handleKonvaInput("cancel", event),
		}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.setupEventListeners()
	}

	public on(type: CanvasInputEventType, handler: CanvasPointerInputHandler): () => void {
		let handlers = this.listeners.get(type)
		if (!handlers) {
			handlers = new Set()
			this.listeners.set(type, handlers)
		}
		handlers.add(handler)

		return () => {
			handlers?.delete(handler)
		}
	}

	public getActivePointerCount(): number {
		return this.activePointerIds.size
	}

	public isMultiPointerGestureActive(): boolean {
		return this.activePointerIds.size > 1
	}

	private setupEventListeners(): void {
		const eventNames = this.usePointerEvents ? POINTER_EVENT_NAMES : FALLBACK_EVENT_NAMES
		this.canvas.stage.on(eventNames.down, this.handlers.down)
		this.canvas.stage.on(eventNames.move, this.handlers.move)
		this.canvas.stage.on(eventNames.up, this.handlers.up)
		this.canvas.stage.on(eventNames.cancel, this.handlers.cancel)
	}

	private updateActivePointers(
		type: CanvasInputEventType,
		event: CanvasNativePointerEvent,
	): void {
		if ("touches" in event) {
			this.activePointerIds.clear()
			Array.from(event.touches).forEach((touch) => {
				this.activePointerIds.add(touch.identifier)
			})
			return
		}

		const pointerId = getPointerId(event)
		if (type === "down") {
			this.activePointerIds.add(pointerId)
		} else if (type === "up" || type === "cancel") {
			this.activePointerIds.delete(pointerId)
		}
	}

	private toStagePoint(client: CanvasInputPoint): CanvasInputPoint {
		const rect = this.canvas.stage.container().getBoundingClientRect()
		return {
			x: client.x - rect.left,
			y: client.y - rect.top,
		}
	}

	private toCanvasPoint(stagePoint: CanvasInputPoint): CanvasInputPoint {
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		return transform.point(stagePoint)
	}

	private normalizeInput(
		type: CanvasInputEventType,
		event: Konva.KonvaEventObject<Event>,
	): CanvasPointerInput | null {
		const nativeEvent = event.evt as CanvasNativePointerEvent
		const client = getClientPointFromNativeEvent(nativeEvent)
		if (!client) return null

		const pointerType = getPointerType(nativeEvent)
		const pointerId = getPointerId(nativeEvent, (event as { pointerId?: number }).pointerId)
		const stage = this.toStagePoint(client)

		return {
			type,
			pointerId,
			pointerType,
			button: getButton(nativeEvent),
			buttons: getButtons(nativeEvent, type),
			client,
			stage,
			canvas: this.toCanvasPoint(stage),
			target: event.target ?? this.canvas.stage,
			modifiers: getModifiers(nativeEvent),
			activePointerCount: this.getActivePointerCount(),
			nativeEvent,
			konvaEvent: event as Konva.KonvaEventObject<CanvasNativePointerEvent>,
		}
	}

	private emit(input: CanvasPointerInput): void {
		const handlers = this.listeners.get(input.type)
		if (!handlers || handlers.size === 0) return

		Array.from(handlers).forEach((handler) => handler(input))
	}

	private handleKonvaInput(
		type: CanvasInputEventType,
		event: Konva.KonvaEventObject<Event>,
	): void {
		const nativeEvent = event.evt as CanvasNativePointerEvent
		if (this.shouldSuppressFallbackMouseEvent(nativeEvent)) {
			return
		}
		this.updateActivePointers(type, nativeEvent)

		const input = this.normalizeInput(type, event)
		if (!input) return

		this.trackFallbackTouch(input)
		this.updateLongPress(input)
		this.emit(input)
	}

	private shouldSuppressFallbackMouseEvent(event: CanvasNativePointerEvent): boolean {
		if (this.usePointerEvents) return false
		if (isTouchEvent(event)) return false
		if (!this.recentTouchState) return false

		const client = getClientPointFromNativeEvent(event)
		if (!client) return false

		const elapsed = Date.now() - this.recentTouchState.time
		if (elapsed > FALLBACK_MOUSE_SUPPRESSION_MS) {
			this.recentTouchState = null
			return false
		}

		const distance = Math.max(
			Math.abs(client.x - this.recentTouchState.client.x),
			Math.abs(client.y - this.recentTouchState.client.y),
		)
		if (distance <= FALLBACK_MOUSE_SUPPRESSION_DISTANCE) {
			return true
		}

		this.recentTouchState = null
		return false
	}

	private trackFallbackTouch(input: CanvasPointerInput): void {
		if (this.usePointerEvents || input.pointerType !== "touch") return
		this.recentTouchState = {
			client: input.client,
			time: Date.now(),
		}
	}

	private updateLongPress(input: CanvasPointerInput): void {
		if (input.type === "down") {
			this.armLongPress(input)
			return
		}

		if (!this.longPressState) return

		if (input.type === "move") {
			const distance = Math.max(
				Math.abs(input.client.x - this.longPressState.client.x),
				Math.abs(input.client.y - this.longPressState.client.y),
			)
			if (
				distance > LONG_PRESS_MOVE_THRESHOLD ||
				input.activePointerCount > 1 ||
				input.pointerId !== this.longPressState.pointerId
			) {
				this.cancelLongPress()
			}
			return
		}

		this.cancelLongPress()
	}

	private armLongPress(input: CanvasPointerInput): void {
		this.cancelLongPress()

		if (input.pointerType === "mouse" || input.activePointerCount !== 1) {
			return
		}

		const elementId =
			resolveManagedElementIdFromKonvaNode(input.target, this.canvas) ??
			getNameLabelElementIdFromNode(input.target)
		if (!elementId) return

		const timer = setTimeout(() => {
			this.longPressState = null
			this.canvas.eventEmitter.emit({
				type: "element:contextmenu",
				data: {
					elementId,
					x: input.client.x,
					y: input.client.y,
				},
			})
		}, LONG_PRESS_DELAY_MS)

		this.longPressState = {
			pointerId: input.pointerId,
			client: input.client,
			elementId,
			timer,
		}
	}

	public cancelLongPress(): void {
		if (!this.longPressState) return
		clearTimeout(this.longPressState.timer)
		this.longPressState = null
	}

	public destroy(): void {
		const eventNames = this.usePointerEvents ? POINTER_EVENT_NAMES : FALLBACK_EVENT_NAMES
		this.canvas.stage.off(eventNames.down, this.handlers.down)
		this.canvas.stage.off(eventNames.move, this.handlers.move)
		this.canvas.stage.off(eventNames.up, this.handlers.up)
		this.canvas.stage.off(eventNames.cancel, this.handlers.cancel)
		this.listeners.clear()
		this.activePointerIds.clear()
		this.recentTouchState = null
		this.cancelLongPress()
	}
}
