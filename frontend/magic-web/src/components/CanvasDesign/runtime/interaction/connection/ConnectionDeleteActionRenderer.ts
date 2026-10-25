import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { getConnectionGeometryPointAt, type ResolvedConnectionGeometry } from "./connectionGeometry"

export type ConnectionDeleteActionInteractionHandler = (connectionId: string) => void

export class ConnectionDeleteActionRenderer {
	public static readonly GROUP_NAME = "connection-delete-action"
	public static readonly BUTTON_NAME = "connection-delete-action-button"
	public static readonly HIT_NAME = "connection-delete-action-hit"
	public static readonly ICON_NAME = "connection-delete-action-icon"

	private static readonly BUTTON_RADIUS_PX = 10
	private static readonly HIT_RADIUS_PX = 12
	private static readonly BORDER_WIDTH_PX = 1
	private static readonly ICON_HALF_SIZE_PX = 4
	private static readonly ICON_STROKE_WIDTH_PX = 1.5
	private static readonly SHADOW_BLUR_PX = 4

	private readonly canvas: Canvas
	private readonly onPointerEnter: ConnectionDeleteActionInteractionHandler
	private readonly onPointerLeave: ConnectionDeleteActionInteractionHandler
	private actionNode: Konva.Group | null = null
	private activeConnectionId: string | null = null
	private interactionState: "idle" | "hover" | "pressed" = "idle"

	constructor(options: {
		canvas: Canvas
		onPointerEnter: ConnectionDeleteActionInteractionHandler
		onPointerLeave: ConnectionDeleteActionInteractionHandler
	}) {
		this.canvas = options.canvas
		this.onPointerEnter = options.onPointerEnter
		this.onPointerLeave = options.onPointerLeave
	}

	public show(
		connectionId: string,
		geometry: ResolvedConnectionGeometry,
		stageScale: number,
	): void {
		if (!this.canShow()) {
			this.hide()
			return
		}

		const node = this.actionNode ?? this.createActionNode()
		const point = getConnectionGeometryPointAt(geometry, 0.5)
		const scale = this.getSafeStageScale(stageScale)
		const radius = ConnectionDeleteActionRenderer.BUTTON_RADIUS_PX / scale
		const hitRadius = ConnectionDeleteActionRenderer.HIT_RADIUS_PX / scale
		const borderWidth = ConnectionDeleteActionRenderer.BORDER_WIDTH_PX / scale
		const iconHalfSize = ConnectionDeleteActionRenderer.ICON_HALF_SIZE_PX / scale
		const iconStrokeWidth = ConnectionDeleteActionRenderer.ICON_STROKE_WIDTH_PX / scale

		node.setAttrs({
			x: point.x,
			y: point.y,
			connectionId,
			visible: true,
		})
		this.updateButtonStyle(node, {
			radius,
			hitRadius,
			borderWidth,
			iconHalfSize,
			iconStrokeWidth,
		})
		node.moveToTop()
		this.actionNode = node
		this.activeConnectionId = connectionId
		this.requestDraw("show")
	}

	public hide(): void {
		if (!this.actionNode && !this.activeConnectionId) return

		this.actionNode?.visible(false)
		this.activeConnectionId = null
		this.interactionState = "idle"
		this.requestDraw("hide")
	}

	public destroy(): void {
		const hadNode = this.actionNode !== null
		this.actionNode?.destroy()
		this.actionNode = null
		this.activeConnectionId = null
		this.interactionState = "idle"
		if (hadNode) {
			this.requestDraw("destroy")
		}
	}

	public getActiveConnectionId(): string | null {
		return this.activeConnectionId
	}

	private createActionNode(): Konva.Group {
		const group = new Konva.Group({
			name: ConnectionDeleteActionRenderer.GROUP_NAME,
			listening: true,
		})
		const button = new Konva.Circle({
			name: ConnectionDeleteActionRenderer.BUTTON_NAME,
			listening: false,
		})
		const hit = new Konva.Circle({
			name: ConnectionDeleteActionRenderer.HIT_NAME,
			fill: "rgba(0, 0, 0, 0)",
			listening: true,
		})
		const icon = new Konva.Group({
			name: ConnectionDeleteActionRenderer.ICON_NAME,
			listening: false,
		})
		icon.add(
			new Konva.Line({ name: "connection-delete-action-icon-a" }),
			new Konva.Line({ name: "connection-delete-action-icon-b" }),
		)
		group.setAttr("connectionId", null)
		group.add(button, hit, icon)

		hit.on("mouseenter", () => {
			const connectionId = this.activeConnectionId
			if (!connectionId) return
			this.updateButtonInteractionState(group, "hover")
			this.onPointerEnter(connectionId)
		})
		hit.on("mouseleave", () => {
			const connectionId = this.activeConnectionId
			if (!connectionId) return
			this.updateButtonInteractionState(group, "idle")
			this.onPointerLeave(connectionId)
		})
		hit.on("mousedown touchstart", (event: Konva.KonvaEventObject<Event>) => {
			this.updateButtonInteractionState(group, "pressed")
			event.cancelBubble = true
			event.evt?.preventDefault?.()
			event.evt?.stopPropagation?.()
		})
		hit.on("mouseup touchend", () => {
			if (this.activeConnectionId) {
				this.updateButtonInteractionState(group, "hover")
			}
		})
		hit.on("click tap", (event: Konva.KonvaEventObject<Event>) => {
			const connectionId = this.activeConnectionId
			if (!connectionId) return
			event.cancelBubble = true
			event.evt?.preventDefault?.()
			event.evt?.stopPropagation?.()
			this.canvas.connectionManager.removeConnection(connectionId)
		})

		this.canvas.controlsLayer.add(group)
		return group
	}

	private updateButtonStyle(
		node: Konva.Group,
		metrics: {
			radius: number
			hitRadius: number
			borderWidth: number
			iconHalfSize: number
			iconStrokeWidth: number
		},
	): void {
		const button = node.findOne(`.${ConnectionDeleteActionRenderer.BUTTON_NAME}`)
		if (button instanceof Konva.Circle) {
			button.setAttrs({
				radius: metrics.radius,
				strokeWidth: metrics.borderWidth,
				shadowColor: "rgba(0, 0, 0, 0.2)",
				shadowBlur:
					ConnectionDeleteActionRenderer.SHADOW_BLUR_PX / this.getSafeStageScale(),
				shadowOffsetY: 1 / this.getSafeStageScale(),
				shadowOpacity: 0.18,
			})
		}

		const hit = node.findOne(`.${ConnectionDeleteActionRenderer.HIT_NAME}`)
		if (hit instanceof Konva.Circle) {
			hit.radius(metrics.hitRadius)
		}

		const icon = node.findOne(`.${ConnectionDeleteActionRenderer.ICON_NAME}`)
		const iconLines =
			icon instanceof Konva.Group
				? icon
						.getChildren()
						.filter(
							(item: Konva.Node): item is Konva.Line => item instanceof Konva.Line,
						)
				: []
		iconLines[0]?.setAttrs({
			points: [
				-metrics.iconHalfSize,
				-metrics.iconHalfSize,
				metrics.iconHalfSize,
				metrics.iconHalfSize,
			],
			strokeWidth: metrics.iconStrokeWidth,
		})
		iconLines[1]?.setAttrs({
			points: [
				-metrics.iconHalfSize,
				metrics.iconHalfSize,
				metrics.iconHalfSize,
				-metrics.iconHalfSize,
			],
			strokeWidth: metrics.iconStrokeWidth,
		})

		this.updateButtonInteractionState(node, this.interactionState)
	}

	private updateButtonInteractionState(
		node: Konva.Group,
		state: "idle" | "hover" | "pressed",
	): void {
		this.interactionState = state
		const style =
			state === "pressed"
				? {
						fill: "#FFE4E6",
						stroke: "#BE123C",
						icon: "#BE123C",
					}
				: state === "hover"
					? {
							fill: "#FFF1F2",
							stroke: "#E11D48",
							icon: "#E11D48",
						}
					: {
							fill: "#FFFFFF",
							stroke: "rgba(0, 0, 0, 0.18)",
							icon: "#4B5563",
						}

		node.setAttr("connectionDeleteActionInteractionState", state)
		const button = node.findOne(`.${ConnectionDeleteActionRenderer.BUTTON_NAME}`)
		if (button instanceof Konva.Circle) {
			button.setAttrs({ fill: style.fill, stroke: style.stroke })
		}
		const icon = node.findOne(`.${ConnectionDeleteActionRenderer.ICON_NAME}`)
		if (icon instanceof Konva.Group) {
			icon.getChildren().forEach((line: Konva.Node) => line.setAttr("stroke", style.icon))
		}
		this.requestDraw(`interaction-${state}`)
	}

	private canShow(): boolean {
		return (
			this.canvas.permissionManager.can("document.delete") &&
			this.canvas.permissionManager.canUseSelectionToolAffordance() &&
			!this.canvas.connectionDragManager?.isDraggingConnection?.() &&
			!this.canvas.stage.isDragging?.()
		)
	}

	private requestDraw(reason: string): void {
		this.canvas.runtimeScheduler.requestLayerDraw("controls", {
			source: "ConnectionDeleteActionRenderer",
			reason,
			priority: "input",
		})
	}

	private getSafeStageScale(scale: number = this.canvas.stage.scaleX()): number {
		return Number.isFinite(scale) && scale > 0 ? scale : 1
	}
}
