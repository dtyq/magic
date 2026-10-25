import Konva from "konva"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import type { Rect } from "../../shared/ids"

export type ConnectionHandleSide = ConnectionOrigin["side"]
export type ConnectionHandleInteractionState = "idle" | "hover" | "active" | "disabled"
export type ConnectionHandleHitRegion = Rect & { side: ConnectionHandleSide }

export type ConnectionHandleOverlayOrigin =
	| Omit<Extract<ConnectionOrigin, { kind: "element" }>, "side">
	| Omit<Extract<ConnectionOrigin, { kind: "selection" }>, "side" | "boundingRect">

interface ConnectionHandleCanvasMetrics {
	radius: number
	offset: number
	strokeWidth: number
	plusHalfSize: number
}

export class ConnectionHandleRenderer {
	public static readonly OVERLAY_GROUP_NAME = "connection-handle-overlay"
	public static readonly EXITING_OVERLAY_GROUP_NAME = "connection-handle-overlay-exiting"
	public static readonly HANDLE_GROUP_NAME = "connection-drag-handle"
	public static readonly HANDLE_CORRIDOR_NAME = "connection-drag-handle-corridor"
	public static readonly HANDLE_CIRCLE_NAME = "connection-drag-handle-circle"
	public static readonly HANDLE_PLUS_HORIZONTAL_NAME = "connection-drag-handle-plus-horizontal"
	public static readonly HANDLE_PLUS_VERTICAL_NAME = "connection-drag-handle-plus-vertical"
	public static readonly HANDLE_ORIGIN_ATTR = "connectionHandleOrigin"
	public static readonly HANDLE_DISABLED_ATTR = "connectionHandleDisabled"

	private static readonly HANDLE_RADIUS_PX = 9
	private static readonly HANDLE_OFFSET_PX = 20
	private static readonly HANDLE_STROKE = "#5a5a5a"
	private static readonly HANDLE_FILL = "#FFFFFF"
	private static readonly HANDLE_STROKE_WIDTH_PX = 1.25
	private static readonly HANDLE_PLUS_SIZE_PX = 7
	private static readonly HANDLE_HOVER_FILL = "#F7F7F7"
	private static readonly HANDLE_ACTIVE_FILL = "#EDEDED"
	private static readonly HANDLE_INTERACTION_STROKE = "#0A0A0A"
	private static readonly HANDLE_DISABLED_FILL = "#F5F5F5"
	private static readonly HANDLE_DISABLED_STROKE = "#B8B8B8"
	private static readonly HANDLE_DISABLED_OPACITY = 0.45
	private static readonly HANDLE_HOVER_SHADOW_OPACITY = 0.12
	private static readonly HANDLE_ACTIVE_SHADOW_OPACITY = 0.18

	public createOverlay(
		origin: ConnectionHandleOverlayOrigin,
		rect: Rect,
		stageScale: number,
		disabledSides: readonly ConnectionHandleSide[] = [],
	): Konva.Group {
		const group = new Konva.Group({
			name: ConnectionHandleRenderer.OVERLAY_GROUP_NAME,
			listening: true,
		})
		group.add(
			this.createCorridorNode("left"),
			this.createCorridorNode("right"),
			this.createHandleNode("left"),
			this.createHandleNode("right"),
		)
		this.updateOverlay(group, origin, rect, stageScale, disabledSides)
		return group
	}

	public setHandleInteractionState(
		handle: Konva.Group,
		state: ConnectionHandleInteractionState,
	): void {
		handle.setAttr("connectionHandleInteractionState", state)
		const style = this.resolveHandleInteractionStyle(state)

		const circle = handle.findOne(`.${ConnectionHandleRenderer.HANDLE_CIRCLE_NAME}`)
		if (circle instanceof Konva.Circle) {
			const radius = circle.radius()
			circle.setAttrs({
				fill: style.fill,
				stroke: style.stroke,
				opacity: style.opacity,
				shadowColor: "rgba(0, 0, 0, 0.22)",
				shadowBlur: style.shadowOpacity > 0 ? radius * 0.25 : 0,
				shadowOffsetX: 0,
				shadowOffsetY: style.shadowOpacity > 0 ? radius * 0.08 : 0,
				shadowOpacity: style.shadowOpacity,
			})
		}

		const plusNodes = [
			handle.findOne(`.${ConnectionHandleRenderer.HANDLE_PLUS_HORIZONTAL_NAME}`),
			handle.findOne(`.${ConnectionHandleRenderer.HANDLE_PLUS_VERTICAL_NAME}`),
		]
		plusNodes.forEach((node) => {
			if (node instanceof Konva.Line) {
				node.stroke(style.stroke)
				node.opacity(style.opacity)
			}
		})
	}

	public setHandleDisabledState(handle: Konva.Group, disabled: boolean): void {
		handle.setAttr(ConnectionHandleRenderer.HANDLE_DISABLED_ATTR, disabled)
		handle.listening(!disabled)
		const currentState = this.getHandleInteractionState(handle)
		this.setHandleInteractionState(
			handle,
			disabled ? "disabled" : currentState === "disabled" ? "idle" : currentState,
		)
	}

	public updateOverlay(
		group: Konva.Group,
		origin: ConnectionHandleOverlayOrigin,
		rect: Rect,
		stageScale: number,
		disabledSides: readonly ConnectionHandleSide[] = [],
	): void {
		const metrics = this.resolveScreenSpaceHandleMetrics(stageScale)
		const centerY = rect.y + rect.height / 2
		const leftHitRegion = this.getHandleHitRegion(rect, stageScale, "left")
		const rightHitRegion = this.getHandleHitRegion(rect, stageScale, "right")

		this.updateCorridorNode(group, {
			origin,
			...leftHitRegion,
		})
		this.updateCorridorNode(group, {
			origin,
			...rightHitRegion,
		})
		this.updateHandleNode(group, {
			origin,
			side: "left",
			x: rect.x - metrics.offset,
			y: centerY,
			radius: metrics.radius,
			strokeWidth: metrics.strokeWidth,
			plusHalfSize: metrics.plusHalfSize,
			disabled: disabledSides.includes("left"),
		})
		this.updateHandleNode(group, {
			origin,
			side: "right",
			x: rect.x + rect.width + metrics.offset,
			y: centerY,
			radius: metrics.radius,
			strokeWidth: metrics.strokeWidth,
			plusHalfSize: metrics.plusHalfSize,
			disabled: disabledSides.includes("right"),
		})
	}

	public getHandleHitRegions(rect: Rect, stageScale: number): ConnectionHandleHitRegion[] {
		return [
			this.getHandleHitRegion(rect, stageScale, "left"),
			this.getHandleHitRegion(rect, stageScale, "right"),
		]
	}

	public isPointInHandleHitRegion(
		rect: Rect,
		stageScale: number,
		point: { x: number; y: number },
	): boolean {
		return this.getHandleHitRegions(rect, stageScale).some((region) =>
			this.isPointInRect(point, region),
		)
	}

	public isPointInHandleKeepAliveRegion(
		rect: Rect,
		stageScale: number,
		point: { x: number; y: number },
	): boolean {
		return (
			this.isPointInRect(point, rect) ||
			this.isPointInHandleHitRegion(rect, stageScale, point)
		)
	}

	private createCorridorNode(side: ConnectionHandleSide): Konva.Rect {
		const corridor = new Konva.Rect({
			name: ConnectionHandleRenderer.HANDLE_CORRIDOR_NAME,
			fill: "rgba(0, 0, 0, 0)",
			listening: true,
		})
		corridor.setAttr("connectionHandleSide", side)
		corridor.on("mousedown touchstart click tap", (event) => {
			event.cancelBubble = true
			event.evt?.stopPropagation()
		})
		return corridor
	}

	private createHandleNode(side: ConnectionHandleSide): Konva.Group {
		const group = new Konva.Group({
			name: ConnectionHandleRenderer.HANDLE_GROUP_NAME,
			listening: true,
		})
		group.setAttr("connectionHandleSide", side)
		group.add(
			new Konva.Circle({
				name: ConnectionHandleRenderer.HANDLE_CIRCLE_NAME,
				listening: true,
			}),
			new Konva.Line({
				name: ConnectionHandleRenderer.HANDLE_PLUS_HORIZONTAL_NAME,
				listening: false,
			}),
			new Konva.Line({
				name: ConnectionHandleRenderer.HANDLE_PLUS_VERTICAL_NAME,
				listening: false,
			}),
		)
		return group
	}

	private updateCorridorNode(
		root: Konva.Group,
		options: {
			origin: ConnectionHandleOverlayOrigin
			side: ConnectionHandleSide
			x: number
			y: number
			width: number
			height: number
		},
	): void {
		const corridor = root
			.find(`.${ConnectionHandleRenderer.HANDLE_CORRIDOR_NAME}`)
			.find((node) => node.getAttr("connectionHandleSide") === options.side)
		if (!(corridor instanceof Konva.Rect)) return

		const elementId =
			options.origin.kind === "element"
				? options.origin.elementId
				: options.origin.elementIds[0]
		corridor.id(elementId ?? "")
		corridor.setAttrs({
			x: options.x,
			y: options.y,
			width: options.width,
			height: options.height,
			fill: "rgba(0, 0, 0, 0)",
			listening: true,
		})
		this.setOriginAttr(corridor, options.origin)
		corridor.setAttr("connectionHandleSide", options.side)
	}

	private updateHandleNode(
		root: Konva.Group,
		options: {
			origin: ConnectionHandleOverlayOrigin
			side: ConnectionHandleSide
			x: number
			y: number
			radius: number
			strokeWidth: number
			plusHalfSize: number
			disabled: boolean
		},
	): void {
		const handle = root
			.find(`.${ConnectionHandleRenderer.HANDLE_GROUP_NAME}`)
			.find((node) => node.getAttr("connectionHandleSide") === options.side)
		if (!(handle instanceof Konva.Group)) return
		const interactionState = this.getHandleInteractionState(handle)

		const elementId =
			options.origin.kind === "element"
				? options.origin.elementId
				: options.origin.elementIds[0]
		handle.id(elementId ?? "")
		handle.position({ x: options.x, y: options.y })
		this.setOriginAttr(handle, options.origin)
		handle.setAttr("connectionHandleSide", options.side)

		const circle = handle.findOne(`.${ConnectionHandleRenderer.HANDLE_CIRCLE_NAME}`)
		if (circle instanceof Konva.Circle) {
			circle.setAttrs({
				x: 0,
				y: 0,
				radius: options.radius,
				fill: ConnectionHandleRenderer.HANDLE_FILL,
				stroke: ConnectionHandleRenderer.HANDLE_STROKE,
				strokeWidth: options.strokeWidth,
				shadowOpacity: 0,
				shadowBlur: 0,
				shadowOffsetX: 0,
				shadowOffsetY: 0,
				listening: true,
			})
		}

		const horizontal = handle.findOne(
			`.${ConnectionHandleRenderer.HANDLE_PLUS_HORIZONTAL_NAME}`,
		)
		if (horizontal instanceof Konva.Line) {
			horizontal.setAttrs({
				points: [-options.plusHalfSize, 0, options.plusHalfSize, 0],
				stroke: ConnectionHandleRenderer.HANDLE_STROKE,
				strokeWidth: options.strokeWidth,
				lineCap: "round",
				listening: false,
			})
		}

		const vertical = handle.findOne(`.${ConnectionHandleRenderer.HANDLE_PLUS_VERTICAL_NAME}`)
		if (vertical instanceof Konva.Line) {
			vertical.setAttrs({
				points: [0, -options.plusHalfSize, 0, options.plusHalfSize],
				stroke: ConnectionHandleRenderer.HANDLE_STROKE,
				strokeWidth: options.strokeWidth,
				lineCap: "round",
				listening: false,
			})
		}

		this.setHandleInteractionState(handle, interactionState)
		this.setHandleDisabledState(handle, options.disabled)
	}

	private getHandleInteractionState(handle: Konva.Group): ConnectionHandleInteractionState {
		const state = handle.getAttr("connectionHandleInteractionState")
		return state === "hover" || state === "active" || state === "disabled" ? state : "idle"
	}

	private setOriginAttr(node: Konva.Node, origin: ConnectionHandleOverlayOrigin): void {
		node.setAttr(
			ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR,
			origin.kind === "element"
				? { ...origin }
				: { ...origin, elementIds: [...origin.elementIds] },
		)
	}

	private resolveHandleInteractionStyle(state: ConnectionHandleInteractionState): {
		fill: string
		stroke: string
		shadowOpacity: number
		opacity: number
	} {
		if (state === "disabled") {
			return {
				fill: ConnectionHandleRenderer.HANDLE_DISABLED_FILL,
				stroke: ConnectionHandleRenderer.HANDLE_DISABLED_STROKE,
				shadowOpacity: 0,
				opacity: ConnectionHandleRenderer.HANDLE_DISABLED_OPACITY,
			}
		}
		if (state === "active") {
			return {
				fill: ConnectionHandleRenderer.HANDLE_ACTIVE_FILL,
				stroke: ConnectionHandleRenderer.HANDLE_INTERACTION_STROKE,
				shadowOpacity: ConnectionHandleRenderer.HANDLE_ACTIVE_SHADOW_OPACITY,
				opacity: 1,
			}
		}
		if (state === "hover") {
			return {
				fill: ConnectionHandleRenderer.HANDLE_HOVER_FILL,
				stroke: ConnectionHandleRenderer.HANDLE_INTERACTION_STROKE,
				shadowOpacity: ConnectionHandleRenderer.HANDLE_HOVER_SHADOW_OPACITY,
				opacity: 1,
			}
		}
		return {
			fill: ConnectionHandleRenderer.HANDLE_FILL,
			stroke: ConnectionHandleRenderer.HANDLE_STROKE,
			shadowOpacity: 0,
			opacity: 1,
		}
	}

	private getSafeStageScale(scale: number): number {
		return Number.isFinite(scale) && scale > 0 ? scale : 1
	}

	private getHandleHitRegion(
		rect: Rect,
		stageScale: number,
		side: ConnectionHandleSide,
	): ConnectionHandleHitRegion {
		const metrics = this.resolveScreenSpaceHandleMetrics(stageScale)
		if (side === "left") {
			return {
				side,
				x: rect.x - metrics.offset - metrics.radius,
				y: rect.y,
				width: metrics.offset + metrics.radius,
				height: rect.height,
			}
		}
		return {
			side,
			x: rect.x + rect.width,
			y: rect.y,
			width: metrics.offset + metrics.radius,
			height: rect.height,
		}
	}

	private isPointInRect(point: { x: number; y: number }, rect: Rect): boolean {
		return (
			point.x >= rect.x &&
			point.x <= rect.x + rect.width &&
			point.y >= rect.y &&
			point.y <= rect.y + rect.height
		)
	}

	private resolveScreenSpaceHandleMetrics(stageScale: number): ConnectionHandleCanvasMetrics {
		const scale = this.getSafeStageScale(stageScale)

		// Handles live in controlsLayer, outside element groups, so only viewport scale is inverted.
		return {
			radius: ConnectionHandleRenderer.HANDLE_RADIUS_PX / scale,
			offset: ConnectionHandleRenderer.HANDLE_OFFSET_PX / scale,
			strokeWidth: ConnectionHandleRenderer.HANDLE_STROKE_WIDTH_PX / scale,
			plusHalfSize: ConnectionHandleRenderer.HANDLE_PLUS_SIZE_PX / 2 / scale,
		}
	}
}
