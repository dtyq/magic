import Konva from "konva"
import {
	COLORS,
	IMAGE_CONFIG,
	LAYOUT,
	resolveImageControlCanvasOffset,
} from "../image/ImageElement.config"
import infoIcon from "../../../assets/svg/Info.svg"
import type { Canvas } from "../../core/Canvas"

export type ElementCornerActionPlacement = "top-right" | "bottom-right"

export type ElementCornerActionIcon = "info" | "fullscreen"

export interface ElementCornerActionClickContext {
	clientX?: number
	clientY?: number
}

interface ElementCornerActionBaseConfig {
	key: string
	placement: ElementCornerActionPlacement
	onClick: (context: ElementCornerActionClickContext) => void
	isEnabled?: () => boolean
	isVisible?: () => boolean
	disabledCursor?: "not-allowed"
}

export type ElementCornerActionConfig = ElementCornerActionBaseConfig &
	(
		| {
				icon: ElementCornerActionIcon
				label?: never
		  }
		| {
				icon?: never
				label: string | (() => string)
				minWidth?: number
		  }
	)

export interface ElementCornerActionsDecoratorConfig {
	elementId: string
	canvas: Canvas
	width: number
	height: number
	actions: ElementCornerActionConfig[]
	showOnSelection?: boolean
}

const LABEL_ACTION_MIN_WIDTH = 40
const LABEL_ACTION_HIT_HEIGHT = 44
const LABEL_ACTION_HIT_PADDING_X = 8
const ACTION_SCREEN_GAP = 4
const ACTION_ACTIVE_SCALE = 0.94
const BUTTON_BG_ACTIVE = "rgba(0, 0, 0, 0.95)"

type ActionInteractionState = "idle" | "hover" | "active"

/**
 * 元素角落操作装饰器：统一管理 info / fullscreen 等悬浮按钮的定位、缩放与交互。
 */
export class ElementCornerActionsDecorator {
	private group: Konva.Group
	private config: ElementCornerActionsDecoratorConfig
	private rootGroup?: Konva.Group
	private actionGroups = new Map<string, Konva.Group>()
	private actionBackgrounds = new Map<string, Konva.Rect>()
	private actionLabels = new Map<string, Konva.Text>()
	private actionHitTargets = new Map<string, Konva.Rect>()
	private actionVisualGroups = new Map<string, Konva.Group>()
	private viewportScaleUnsubscribe?: () => void
	private elementTransformHandler?: () => void
	private hoverChangeHandler?: (event: { data: { elementId: string | null } }) => void
	private selectHandler?: () => void
	private deselectHandler?: () => void
	private mouseEnterHandler?: () => void
	private mouseLeaveHandler?: () => void
	private dragStartHandler?: () => void
	private dragEndHandler?: () => void
	private permissionChangedHandler?: () => void
	private isHovering = false

	constructor(group: Konva.Group, config: ElementCornerActionsDecoratorConfig) {
		this.group = group
		this.config = config
	}

	public create(): void {
		this.removeViewportScaleListener()
		this.destroyButtonNodes()
		if (this.config.actions.length === 0) return

		const rootGroup = new Konva.Group({
			x: 0,
			y: 0,
			listening: true,
			visible: false,
			name: "decorator-corner-actions",
		})

		this.rootGroup = rootGroup
		this.actionGroups.clear()
		this.actionBackgrounds.clear()
		this.actionLabels.clear()
		this.actionHitTargets.clear()
		this.actionVisualGroups.clear()

		this.config.actions.forEach((action) => {
			const actionGroup = this.createActionButton(action)
			rootGroup.add(actionGroup)
			this.actionGroups.set(action.key, actionGroup)
		})
		this.config.actions.forEach((action) => this.refreshAction(action))

		this.group.add(rootGroup)
		rootGroup.moveToTop()
		this.updateButtonScale()
		this.setupElementTransformListener()
		this.setupHoverBehavior()
		this.syncHoverStateFromCanvas()
		this.group.getLayer()?.batchDraw()
	}

	private createActionButton(action: ElementCornerActionConfig): Konva.Group {
		const buttonSize = IMAGE_CONFIG.INFO_BUTTON_SIZE
		const buttonGroup = new Konva.Group({
			listening: true,
			name: `decorator-corner-action-${action.key}`,
		})
		const isLabelAction = "label" in action && action.label !== undefined
		const labelText = isLabelAction ? this.resolveActionLabel(action) : ""
		const labelNode = isLabelAction
			? new Konva.Text({
					text: labelText,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					fill: "#FAFAFA",
					align: "center",
					wrap: "none",
					verticalAlign: "middle",
					listening: false,
					name: `decorator-corner-action-${action.key}-label`,
				})
			: undefined
		const visualWidth = labelNode
			? Math.max(
					action.minWidth ?? LABEL_ACTION_MIN_WIDTH,
					Math.ceil(labelNode.getTextWidth() + LAYOUT.TEXT_PADDING_X * 2),
				)
			: buttonSize
		const visualGroup = labelNode
			? new Konva.Group({
					x: visualWidth / 2,
					y: buttonSize / 2,
					listening: false,
					name: `decorator-corner-action-${action.key}-visual`,
				})
			: undefined

		const buttonBg = new Konva.Rect({
			x: visualGroup ? -visualWidth / 2 : 0,
			y: visualGroup ? -buttonSize / 2 : 0,
			width: visualWidth,
			height: buttonSize,
			cornerRadius: IMAGE_CONFIG.CORNER_RADIUS,
			fill: COLORS.BUTTON_BG,
			listening: true,
			name: `decorator-corner-action-${action.key}-button`,
		})

		buttonGroup.size({ width: visualWidth, height: buttonSize })
		this.actionBackgrounds.set(action.key, buttonBg)
		if (labelNode && visualGroup) {
			labelNode.position({ x: -visualWidth / 2, y: -buttonSize / 2 })
			labelNode.width(visualWidth)
			labelNode.height(buttonSize)
			visualGroup.add(buttonBg, labelNode)
			buttonGroup.add(visualGroup)
			this.actionLabels.set(action.key, labelNode)
			this.actionVisualGroups.set(action.key, visualGroup)
			const hitTarget = new Konva.Rect({
				x: -LABEL_ACTION_HIT_PADDING_X,
				y: -(LABEL_ACTION_HIT_HEIGHT - buttonSize) / 2,
				width: visualWidth + LABEL_ACTION_HIT_PADDING_X * 2,
				height: LABEL_ACTION_HIT_HEIGHT,
				fill: "rgba(0, 0, 0, 0.001)",
				name: `decorator-corner-action-${action.key}-hit`,
			})
			buttonGroup.add(hitTarget)
			this.actionHitTargets.set(action.key, hitTarget)
			this.setupButtonEvents(hitTarget, buttonBg, action)
		} else {
			buttonGroup.add(buttonBg)
			this.addIconNode(buttonGroup, action)
			this.actionHitTargets.set(action.key, buttonBg)
			this.setupButtonEvents(buttonBg, buttonBg, action)
		}
		return buttonGroup
	}

	private addIconNode(buttonGroup: Konva.Group, action: ElementCornerActionConfig): void {
		if (!("icon" in action) || !action.icon) return
		if (action.icon === "fullscreen") {
			buttonGroup.add(this.createFullscreenIcon())
			return
		}

		const iconImage = new Image()
		iconImage.onload = () => {
			if (this.actionGroups.get(action.key) !== buttonGroup) return
			const iconSize = IMAGE_CONFIG.INFO_ICON_SIZE
			const iconOffset = (IMAGE_CONFIG.INFO_BUTTON_SIZE - iconSize) / 2
			buttonGroup.add(
				new Konva.Image({
					image: iconImage,
					width: iconSize,
					height: iconSize,
					x: iconOffset,
					y: iconOffset,
					listening: false,
				}),
			)
			buttonGroup.moveToTop()
			this.group.getLayer()?.batchDraw()
		}
		iconImage.src = infoIcon
	}

	private createFullscreenIcon(): Konva.Group {
		const size = 14
		const corner = 4
		const stroke = 1.5
		const iconOffset = (IMAGE_CONFIG.INFO_BUTTON_SIZE - size) / 2
		const icon = new Konva.Group({
			x: iconOffset,
			y: iconOffset,
			width: size,
			height: size,
			listening: false,
		})
		const lines = [
			[corner, 0, 0, 0, 0, corner],
			[size - corner, 0, size, 0, size, corner],
			[0, size - corner, 0, size, corner, size],
			[size, size - corner, size, size, size - corner, size],
		]

		lines.forEach((points) => {
			icon.add(
				new Konva.Line({
					points,
					stroke: "#FAFAFA",
					strokeWidth: stroke,
					lineCap: "round",
					lineJoin: "round",
					listening: false,
				}),
			)
		})

		return icon
	}

	private resolveActionLabel(action: ElementCornerActionConfig): string {
		if (!("label" in action) || action.label === undefined) return ""
		return typeof action.label === "function" ? action.label() : action.label
	}

	private isActionEnabled(action: ElementCornerActionConfig): boolean {
		return (
			this.config.canvas.permissionManager.canUseSelectionToolAffordance() &&
			(action.isEnabled?.() ?? true)
		)
	}

	private isActionVisible(action: ElementCornerActionConfig): boolean {
		return action.isVisible?.() ?? true
	}

	private refreshAction(action: ElementCornerActionConfig): void {
		const actionGroup = this.actionGroups.get(action.key)
		const buttonBg = this.actionBackgrounds.get(action.key)
		if (!actionGroup || !buttonBg) return

		const labelNode = this.actionLabels.get(action.key)
		if (labelNode) {
			labelNode.text(this.resolveActionLabel(action))
			const visualWidth = Math.max(
				"minWidth" in action
					? (action.minWidth ?? LABEL_ACTION_MIN_WIDTH)
					: LABEL_ACTION_MIN_WIDTH,
				Math.ceil(labelNode.getTextWidth() + LAYOUT.TEXT_PADDING_X * 2),
			)
			actionGroup.width(visualWidth)
			const visualGroup = this.actionVisualGroups.get(action.key)
			visualGroup?.position({
				x: visualWidth / 2,
				y: IMAGE_CONFIG.INFO_BUTTON_SIZE / 2,
			})
			visualGroup?.scale({ x: 1, y: 1 })
			buttonBg.position({
				x: -visualWidth / 2,
				y: -IMAGE_CONFIG.INFO_BUTTON_SIZE / 2,
			})
			buttonBg.width(visualWidth)
			labelNode.width(visualWidth)
			labelNode.height(IMAGE_CONFIG.INFO_BUTTON_SIZE)
			labelNode.position({
				x: -visualWidth / 2,
				y: -IMAGE_CONFIG.INFO_BUTTON_SIZE / 2,
			})
			const hitTarget = this.actionHitTargets.get(action.key)
			if (hitTarget && hitTarget !== buttonBg) {
				hitTarget.width(visualWidth + LABEL_ACTION_HIT_PADDING_X * 2)
			}
		}

		actionGroup.visible(this.isActionVisible(action))
		actionGroup.opacity(this.isActionEnabled(action) ? 1 : 0.55)
		buttonBg.fill(COLORS.BUTTON_BG)
	}

	private hasVisibleActions(): boolean {
		return this.config.actions.some((action) => this.isActionVisible(action))
	}

	private setupButtonEvents(
		hitTarget: Konva.Rect,
		buttonBg: Konva.Rect,
		action: ElementCornerActionConfig,
	): void {
		let pointerInside = false
		const visualGroup = this.actionVisualGroups.get(action.key)
		const setInteractionState = (state: ActionInteractionState) => {
			const enabled = this.isActionEnabled(action)
			const resolvedState = enabled ? state : "idle"
			buttonBg.fill(
				resolvedState === "active"
					? visualGroup
						? BUTTON_BG_ACTIVE
						: COLORS.BUTTON_BG_HOVER
					: resolvedState === "hover"
						? COLORS.BUTTON_BG_HOVER
						: COLORS.BUTTON_BG,
			)
			visualGroup?.scale({
				x: resolvedState === "active" ? ACTION_ACTIVE_SCALE : 1,
				y: resolvedState === "active" ? ACTION_ACTIVE_SCALE : 1,
			})
			this.group.getLayer()?.batchDraw()
		}
		const stopEvent = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
			}
		}
		const handleAction = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
			stopEvent(e)
			e.evt?.stopImmediatePropagation?.()

			if (!this.isActionEnabled(action)) return

			this.config.canvas.selectionManager.replaceSelection([this.config.elementId])
			action.onClick(this.resolveActionClickContext(e.evt))
		}

		hitTarget.on("mousedown", (e) => {
			setInteractionState("active")
			handleAction(e)
		})
		hitTarget.on("tap", handleAction)

		hitTarget.on("mouseup", (e) => {
			stopEvent(e)
			setInteractionState(pointerInside ? "hover" : "idle")
		})
		hitTarget.on("mousemove click tap", (e) => {
			stopEvent(e)
		})

		hitTarget.on("mouseenter", () => {
			pointerInside = true
			const enabled = this.isActionEnabled(action)
			setInteractionState("hover")
			if (enabled) {
				this.config.canvas.cursorManager.setTemporary("pointer")
			} else if (action.disabledCursor) {
				this.config.canvas.cursorManager.setTemporary(action.disabledCursor)
			}
		})

		hitTarget.on("mouseleave", () => {
			pointerInside = false
			setInteractionState("idle")
			this.config.canvas.cursorManager.restoreToolCursor()
		})

		hitTarget.on("touchstart", (e) => {
			stopEvent(e)
			if (!this.isActionEnabled(action)) return
			setInteractionState("active")
		})

		hitTarget.on("touchend touchcancel", (e) => {
			stopEvent(e)
			setInteractionState("idle")
		})
	}

	private resolveActionClickContext(
		event: MouseEvent | TouchEvent | undefined,
	): ElementCornerActionClickContext {
		if (!event) return {}
		if (
			"clientX" in event &&
			Number.isFinite(event.clientX) &&
			Number.isFinite(event.clientY)
		) {
			return { clientX: event.clientX, clientY: event.clientY }
		}
		const touch = event.changedTouches?.[0] ?? event.touches?.[0]
		return touch ? { clientX: touch.clientX, clientY: touch.clientY } : {}
	}

	public updateButtonScale(options?: { refreshActions?: boolean }): void {
		if (!this.rootGroup) return

		const stage = this.group.getStage()
		if (!stage) return

		const viewportScale = stage.scaleX()
		const elementScaleX = this.group.scaleX()
		const elementScaleY = this.group.scaleY()
		const elementScreenWidth = Math.abs(this.config.width * elementScaleX * viewportScale)
		const elementScreenHeight = Math.abs(this.config.height * elementScaleY * viewportScale)
		const minElementScreenSize = Math.min(elementScreenWidth, elementScreenHeight)

		if (minElementScreenSize < IMAGE_CONFIG.MIN_ELEMENT_SCREEN_SIZE_FOR_INFO_BUTTON) {
			this.rootGroup.visible(false)
			return
		}

		const inverseScaleX = 1 / (viewportScale * elementScaleX)
		const inverseScaleY = 1 / (viewportScale * elementScaleY)
		const canvasOffsetX = resolveImageControlCanvasOffset(viewportScale * elementScaleX)
		const canvasOffsetY = resolveImageControlCanvasOffset(viewportScale * elementScaleY)

		const placementOffsets = new Map<ElementCornerActionPlacement, number>()
		this.config.actions.forEach((action) => {
			if (options?.refreshActions !== false) this.refreshAction(action)
			const actionGroup = this.actionGroups.get(action.key)
			if (!actionGroup || !actionGroup.visible()) return
			const scaledButtonWidth = actionGroup.width() * inverseScaleX
			const scaledButtonHeight = actionGroup.height() * inverseScaleY
			const placementOffset = placementOffsets.get(action.placement) ?? 0
			actionGroup.scale({ x: inverseScaleX, y: inverseScaleY })
			actionGroup.position({
				x:
					this.resolveActionX(action.placement, scaledButtonWidth, canvasOffsetX) -
					placementOffset,
				y: this.resolveActionY(action.placement, scaledButtonHeight, canvasOffsetY),
			})
			placementOffsets.set(
				action.placement,
				placementOffset + scaledButtonWidth + ACTION_SCREEN_GAP * inverseScaleX,
			)
		})

		this.rootGroup.visible(
			this.isHovering && !this.hasMultipleSelection() && this.hasVisibleActions(),
		)
		this.rootGroup.moveToTop()
	}

	public refresh(): void {
		this.syncHoverStateFromCanvas()
		this.updateButtonScale()
		this.rootGroup?.getLayer()?.batchDraw()
	}

	private resolveActionX(
		placement: ElementCornerActionPlacement,
		scaledButtonWidth: number,
		canvasOffsetX: number,
	): number {
		if (placement === "top-right" || placement === "bottom-right") {
			return this.config.width - scaledButtonWidth - canvasOffsetX
		}
		return canvasOffsetX
	}

	private resolveActionY(
		placement: ElementCornerActionPlacement,
		scaledButtonHeight: number,
		canvasOffsetY: number,
	): number {
		if (placement === "bottom-right") {
			return this.config.height - scaledButtonHeight - canvasOffsetY
		}
		return canvasOffsetY
	}

	public updateConfig(config: Partial<ElementCornerActionsDecoratorConfig>): void {
		const nextActions = config.actions ?? this.config.actions
		const shouldRecreate = config.actions !== undefined
		this.config = { ...this.config, ...config, actions: nextActions }

		if (shouldRecreate) {
			this.create()
			return
		}

		this.updateButtonScale()
	}

	private setupViewportScaleListener(): void {
		if (this.viewportScaleUnsubscribe) return
		const viewportScaleHandler = () => {
			if (!this.rootGroup) return
			this.updateButtonScale({ refreshActions: false })
		}
		this.viewportScaleUnsubscribe =
			this.config.canvas.runtimeScheduler.registerViewportScaleLayout(
				this.config.elementId,
				viewportScaleHandler,
			)
	}

	private removeViewportScaleListener(): void {
		this.viewportScaleUnsubscribe?.()
		this.viewportScaleUnsubscribe = undefined
	}

	private setupElementTransformListener(): void {
		if (this.elementTransformHandler) return
		this.elementTransformHandler = () => {
			this.updateButtonScale()
			this.rootGroup?.getLayer()?.batchDraw()
		}
		this.group.on("transform", this.elementTransformHandler)
	}

	private removeElementTransformListener(): void {
		if (!this.elementTransformHandler) return
		this.group.off("transform", this.elementTransformHandler)
		this.elementTransformHandler = undefined
	}

	private setupHoverBehavior(): void {
		if (!this.hoverChangeHandler) {
			this.hoverChangeHandler = () => {
				this.syncHoverStateFromCanvas()
			}
			this.config.canvas.eventEmitter.on("element:hover", this.hoverChangeHandler)
		}

		if (!this.selectHandler) {
			this.selectHandler = () => {
				this.syncHoverStateFromCanvas()
			}
			this.config.canvas.eventEmitter.on("element:select", this.selectHandler)
		}

		if (!this.mouseEnterHandler) {
			this.mouseEnterHandler = () => {
				if (!this.config.canvas.permissionManager.canUseSelectionToolAffordance()) {
					return
				}
				this.show()
			}
			this.group.on("mouseenter", this.mouseEnterHandler)
		}

		if (!this.mouseLeaveHandler) {
			this.mouseLeaveHandler = () => {
				if (
					(this.shouldUseTouchAffordance() || this.config.showOnSelection) &&
					this.config.canvas.selectionManager.isSelected(this.config.elementId)
				) {
					this.show()
					return
				}
				this.hide()
			}
			this.group.on("mouseleave", this.mouseLeaveHandler)
		}

		if (!this.deselectHandler) {
			this.deselectHandler = () => {
				if (!this.config.canvas.selectionManager.isSelected(this.config.elementId)) {
					this.hide()
				}
			}
			this.config.canvas.eventEmitter.on("element:deselect", this.deselectHandler)
		}

		if (!this.dragStartHandler) {
			this.dragStartHandler = () => {
				this.hide()
			}
			this.group.on("dragstart", this.dragStartHandler)
		}

		if (!this.dragEndHandler) {
			this.dragEndHandler = () => {
				if (!this.config.canvas.permissionManager.canUseSelectionToolAffordance()) {
					return
				}
				const stage = this.group.getStage()
				const pointerPos = stage?.getPointerPosition()
				if (!stage || !pointerPos) return
				const shape = stage.getIntersection(pointerPos)
				const isInGroup =
					shape &&
					(this.group.findOne(
						(node: Konva.Node) => node === shape || shape.getAncestors().includes(node),
					) ||
						shape.name().startsWith("decorator-"))
				if (isInGroup) {
					this.show()
				}
			}
			this.group.on("dragend", this.dragEndHandler)
		}

		if (!this.permissionChangedHandler) {
			this.permissionChangedHandler = () => {
				this.refresh()
			}
			this.config.canvas.eventEmitter.on("permission:changed", this.permissionChangedHandler)
		}
	}

	private removeHoverBehavior(): void {
		if (this.hoverChangeHandler) {
			this.config.canvas.eventEmitter.off("element:hover", this.hoverChangeHandler)
			this.hoverChangeHandler = undefined
		}
		if (this.selectHandler) {
			this.config.canvas.eventEmitter.off("element:select", this.selectHandler)
			this.selectHandler = undefined
		}
		if (this.mouseEnterHandler) {
			this.group.off("mouseenter", this.mouseEnterHandler)
			this.mouseEnterHandler = undefined
		}
		if (this.mouseLeaveHandler) {
			this.group.off("mouseleave", this.mouseLeaveHandler)
			this.mouseLeaveHandler = undefined
		}
		if (this.deselectHandler) {
			this.config.canvas.eventEmitter.off("element:deselect", this.deselectHandler)
			this.deselectHandler = undefined
		}
		if (this.dragStartHandler) {
			this.group.off("dragstart", this.dragStartHandler)
			this.dragStartHandler = undefined
		}
		if (this.dragEndHandler) {
			this.group.off("dragend", this.dragEndHandler)
			this.dragEndHandler = undefined
		}
		if (this.permissionChangedHandler) {
			this.config.canvas.eventEmitter.off("permission:changed", this.permissionChangedHandler)
			this.permissionChangedHandler = undefined
		}
	}

	private syncHoverStateFromCanvas(): void {
		if (
			!this.config.canvas.permissionManager.canUseSelectionToolAffordance() ||
			this.isConnectionDragging() ||
			this.hasMultipleSelection()
		) {
			this.hide()
			return
		}

		if (this.config.canvas.hoverManager.getHoveredElementId() === this.config.elementId) {
			this.show()
			return
		}

		if (
			(this.shouldUseTouchAffordance() || this.config.showOnSelection) &&
			this.config.canvas.selectionManager.isSelected(this.config.elementId)
		) {
			this.show()
			return
		}

		if (!this.config.canvas.selectionManager.isSelected(this.config.elementId)) {
			this.hide()
		}
	}

	private shouldUseTouchAffordance(): boolean {
		return this.config.canvas.deviceInfo?.input.touch === true
	}

	public show(): void {
		if (
			this.isConnectionDragging() ||
			this.hasMultipleSelection() ||
			!this.hasVisibleActions()
		) {
			this.hide()
			return
		}
		this.isHovering = true
		if (!this.rootGroup) return
		// 画布上同时只会有极少量可见角落控件，隐藏时不保留逐元素缩放监听。
		this.setupViewportScaleListener()
		this.rootGroup.visible(true)
		this.rootGroup.moveToTop()
		this.updateButtonScale()
		this.group.getLayer()?.batchDraw()
	}

	public hide(): void {
		this.isHovering = false
		this.removeViewportScaleListener()
		if (!this.rootGroup) return
		this.rootGroup.visible(false)
		this.group.getLayer()?.batchDraw()
	}

	private isConnectionDragging(): boolean {
		return this.config.canvas.connectionDragManager?.isDraggingConnection?.() === true
	}

	private hasMultipleSelection(): boolean {
		return this.config.canvas.selectionManager.getSelectionCount() > 1
	}

	private destroyButtonNodes(): void {
		this.rootGroup?.destroy()
		this.rootGroup = undefined
		this.actionGroups.clear()
		this.actionBackgrounds.clear()
		this.actionLabels.clear()
		this.actionHitTargets.clear()
		this.actionVisualGroups.clear()
	}

	public destroy(): void {
		this.removeViewportScaleListener()
		this.removeElementTransformListener()
		this.removeHoverBehavior()
		this.destroyButtonNodes()
	}
}
