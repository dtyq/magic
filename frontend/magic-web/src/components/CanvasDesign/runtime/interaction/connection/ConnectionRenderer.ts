import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { resolveConnectionGeometry, type ResolvedConnectionGeometry } from "./connectionGeometry"
import type { CanvasConnection } from "../../document/types"
import {
	CONNECTION_HOVER_LINE_STYLE,
	CONNECTION_HIT_STYLE,
	CONNECTION_LINE_STYLE,
	CONNECTION_SELECTED_LINE_STYLE,
	resolveConnectionCanvasStrokeWidth,
} from "./connectionStyle"
import {
	CONNECTION_GROUP_NAME,
	CONNECTION_HIT_PATH_NAME,
	CONNECTION_VISUAL_PATH_NAME,
} from "./connectionNodeUtils"
import { ConnectionDeleteActionRenderer } from "./ConnectionDeleteActionRenderer"

interface ConnectionRenderOptions {
	selectedConnectionIds?: string[]
	highlightedConnectionIds?: string[]
}

interface ConnectionLineStyle {
	stroke: string
	strokeWidth: number
	opacity: number
	shadowColor: string
	shadowBlur: number
	shadowOpacity: number
}

interface ConnectionRenderContainer {
	parentId: string
	container: Konva.Group
}

interface RenderedConnectionNode {
	node: Konva.Group
	container: Konva.Group
}

const LOCAL_CONNECTION_CONTAINER_NAME = "canvas-local-connections"

export class ConnectionRenderer {
	private canvas: Canvas
	private deleteActionRenderer: ConnectionDeleteActionRenderer
	private renderedNodes = new Map<string, RenderedConnectionNode>()
	private renderedConnectionGeometries = new Map<string, ResolvedConnectionGeometry>()
	private localConnectionContainers = new Map<string, Konva.Group>()
	private hoveredConnectionIds = new Set<string>()
	private highlightedConnectionIds = new Set<string>()
	private pendingHoverLeaveFrameIds = new Map<string, number>()

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.deleteActionRenderer = new ConnectionDeleteActionRenderer({
			canvas: this.canvas,
			onPointerEnter: (connectionId) => this.handleDeleteActionPointerEnter(connectionId),
			onPointerLeave: (connectionId) => this.handleDeleteActionPointerLeave(connectionId),
		})
	}

	public render(connections: CanvasConnection[], options: ConnectionRenderOptions = {}): void {
		if (connections.length === 0 && !this.hasRenderedState()) {
			return
		}

		const connectionGroup = this.canvas.ensureConnectionGroup()
		const selectedConnectionIdSet = new Set(options.selectedConnectionIds ?? [])
		this.highlightedConnectionIds = new Set(options.highlightedConnectionIds ?? [])
		const desiredGeometryIds = new Set<string>()
		const desiredSlotKeys = new Set<string>()
		const desiredLocalParentIds = new Set<string>()

		const selectedNodes: Konva.Group[] = []
		for (const connection of connections) {
			const isSelected =
				selectedConnectionIdSet.has(connection.id) ||
				this.highlightedConnectionIds.has(connection.id)
			const geometry = this.resolveGeometry(connection)
			if (!geometry) continue
			desiredGeometryIds.add(connection.id)
			this.renderedConnectionGeometries.set(connection.id, geometry)

			const sharedLocalContainer = this.resolveSharedLocalConnectionContainer(connection)
			if (sharedLocalContainer) {
				desiredLocalParentIds.add(sharedLocalContainer.parentId)
				this.upsertConnectionNode({
					slotKey: this.createLocalSlotKey(sharedLocalContainer.parentId, connection.id),
					connection,
					geometry,
					container: sharedLocalContainer.container,
					selected: isSelected,
					desiredSlotKeys,
					selectedNodes,
				})
				continue
			}

			this.upsertConnectionNode({
				slotKey: this.createGlobalSlotKey(connection.id),
				connection,
				geometry,
				container: connectionGroup,
				selected: isSelected,
				desiredSlotKeys,
				selectedNodes,
			})
			for (const endpointLocalContainer of this.resolveEndpointLocalConnectionContainers(
				connection,
			)) {
				desiredLocalParentIds.add(endpointLocalContainer.parentId)
				this.upsertConnectionNode({
					slotKey: this.createLocalSlotKey(
						endpointLocalContainer.parentId,
						connection.id,
					),
					connection,
					geometry,
					container: endpointLocalContainer.container,
					selected: isSelected,
					desiredSlotKeys,
					selectedNodes,
				})
			}
		}
		this.destroyStaleConnectionNodes(desiredSlotKeys)
		this.destroyUnusedLocalConnectionContainers(desiredLocalParentIds)
		this.pruneRenderedConnectionGeometries(desiredGeometryIds)
		this.pruneConnectionHoverState(desiredGeometryIds)
		this.syncDeleteAction()
		selectedNodes.forEach((node) => {
			if (node.getParent()) {
				node.moveToTop()
			}
		})

		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ConnectionRenderer",
			reason: "render",
			priority: "normal",
		})
	}

	private hasRenderedState(): boolean {
		return (
			this.renderedNodes.size > 0 ||
			this.renderedConnectionGeometries.size > 0 ||
			this.localConnectionContainers.size > 0 ||
			this.hoveredConnectionIds.size > 0 ||
			this.highlightedConnectionIds.size > 0 ||
			this.pendingHoverLeaveFrameIds.size > 0 ||
			this.deleteActionRenderer.getActiveConnectionId() !== null
		)
	}

	public clear(): void {
		const connectionGroup = this.canvas.ensureConnectionGroup()
		this.clearConnectionHoverState({ restoreCursor: true })
		this.deleteActionRenderer.destroy()
		this.highlightedConnectionIds.clear()
		this.destroyAllConnectionNodes()
		this.renderedConnectionGeometries.clear()
		connectionGroup.destroyChildren()
		this.clearLocalConnectionContainers()
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ConnectionRenderer",
			reason: "clear",
			priority: "normal",
		})
	}

	public destroy(): void {
		this.clear()
	}

	public clearHover(): void {
		const hoveredConnectionIds = Array.from(this.hoveredConnectionIds)
		this.clearConnectionHoverState({ restoreCursor: true })
		hoveredConnectionIds.forEach((connectionId) => {
			this.applyInteractiveLineStyle(connectionId, "idle")
		})
	}

	private createConnectionNode(
		connection: CanvasConnection,
		geometry: ResolvedConnectionGeometry,
		selected: boolean,
	): Konva.Group {
		const scale = this.getSafeStageScale()
		const lineStyle = this.resolveLineStyle(connection.id, selected)
		const group = new Konva.Group({
			name: CONNECTION_GROUP_NAME,
			listening: true,
		})
		group.setAttr("connectionId", connection.id)
		group.setAttr("connectionData", {
			connectionId: connection.id,
			sourceElementId: connection.sourceElementId,
			targetElementId: connection.targetElementId,
			sourceSide: geometry.sourceSide,
			targetSide: geometry.targetSide,
		})

		const hitPath = new Konva.Path({
			name: CONNECTION_HIT_PATH_NAME,
			data: geometry.pathData,
			stroke: "rgba(0, 0, 0, 0)",
			strokeWidth: CONNECTION_HIT_STYLE.strokeWidth / scale,
			lineCap: "round",
			lineJoin: "round",
			listening: true,
		})
		hitPath.setAttr("connectionId", connection.id)
		hitPath.setAttr("connectionData", group.getAttr("connectionData"))
		this.bindHitPathEvents(hitPath, connection.id)

		const path = new Konva.Path({
			name: CONNECTION_VISUAL_PATH_NAME,
			data: geometry.pathData,
			stroke: lineStyle.stroke,
			strokeWidth: resolveConnectionCanvasStrokeWidth(lineStyle.strokeWidth, scale),
			opacity: lineStyle.opacity,
			lineCap: "round",
			lineJoin: "round",
			shadowColor: lineStyle.shadowColor,
			shadowBlur: lineStyle.shadowBlur / scale,
			shadowOpacity: lineStyle.shadowOpacity,
			listening: false,
		})
		path.setAttr("connectionId", connection.id)
		path.setAttr("connectionData", {
			connectionId: connection.id,
			sourceElementId: connection.sourceElementId,
			targetElementId: connection.targetElementId,
			sourceSide: geometry.sourceSide,
			targetSide: geometry.targetSide,
		})

		group.add(hitPath, path)
		return group
	}

	private updateConnectionNode(
		node: Konva.Group,
		connection: CanvasConnection,
		geometry: ResolvedConnectionGeometry,
		selected: boolean,
	): void {
		const connectionData = {
			connectionId: connection.id,
			sourceElementId: connection.sourceElementId,
			targetElementId: connection.targetElementId,
			sourceSide: geometry.sourceSide,
			targetSide: geometry.targetSide,
		}
		node.setAttr("connectionId", connection.id)
		node.setAttr("connectionData", connectionData)

		const scale = this.getSafeStageScale()
		const hitPath = node.findOne(`.${CONNECTION_HIT_PATH_NAME}`)
		if (hitPath instanceof Konva.Path) {
			hitPath.setAttrs({
				data: geometry.pathData,
				strokeWidth: CONNECTION_HIT_STYLE.strokeWidth / scale,
			})
			hitPath.setAttr("connectionId", connection.id)
			hitPath.setAttr("connectionData", connectionData)
		}

		const visualPath = node.findOne(`.${CONNECTION_VISUAL_PATH_NAME}`)
		if (visualPath instanceof Konva.Path) {
			visualPath.setAttrs({
				data: geometry.pathData,
			})
			visualPath.setAttr("connectionId", connection.id)
			visualPath.setAttr("connectionData", connectionData)
			this.applyLineStyle(visualPath, this.resolveLineStyle(connection.id, selected))
		}
	}

	private upsertConnectionNode(options: {
		slotKey: string
		connection: CanvasConnection
		geometry: ResolvedConnectionGeometry
		container: Konva.Group
		selected: boolean
		desiredSlotKeys: Set<string>
		selectedNodes: Konva.Group[]
	}): void {
		const existingRecord = this.renderedNodes.get(options.slotKey)
		const node =
			existingRecord?.node ??
			this.createConnectionNode(options.connection, options.geometry, options.selected)

		if (!existingRecord) {
			options.container.add(node)
			this.renderedNodes.set(options.slotKey, {
				node,
				container: options.container,
			})
		} else if (existingRecord.container !== options.container) {
			node.moveTo(options.container)
			existingRecord.container = options.container
		}

		this.updateConnectionNode(node, options.connection, options.geometry, options.selected)
		options.desiredSlotKeys.add(options.slotKey)
		if (options.selected) {
			options.selectedNodes.push(node)
		}
	}

	private clearLocalConnectionContainers(): void {
		this.localConnectionContainers.forEach((container) => container.destroy())
		this.localConnectionContainers.clear()
		this.canvas.contentLayer
			?.find?.(`.${LOCAL_CONNECTION_CONTAINER_NAME}`)
			.forEach((node) => node.destroy())
	}

	private resolveSharedLocalConnectionContainer(
		connection: CanvasConnection,
	): ConnectionRenderContainer | null {
		const parentId = this.resolveSharedParentId(connection)
		if (!parentId) return null
		const container = this.getOrCreateLocalConnectionContainer(parentId)
		return container ? { parentId, container } : null
	}

	private resolveEndpointLocalConnectionContainers(
		connection: CanvasConnection,
	): ConnectionRenderContainer[] {
		const parentIds = new Set([
			...this.resolveEndpointVisibleContainerIds(connection.sourceElementId),
			...this.resolveEndpointVisibleContainerIds(connection.targetElementId),
		])

		return Array.from(parentIds)
			.map((parentId) => {
				const container = this.getOrCreateLocalConnectionContainer(parentId)
				return container ? { parentId, container } : null
			})
			.filter((item): item is ConnectionRenderContainer => item !== null)
	}

	private resolveEndpointVisibleContainerIds(elementId: string): string[] {
		return this.getAncestorElementIds(elementId).filter((parentId) => {
			const parentNode = this.canvas.elementManager.getElementInstance?.(parentId)?.getNode()
			return (
				parentNode instanceof Konva.Group && this.isVisibleConnectionContainer(parentNode)
			)
		})
	}

	private getOrCreateLocalConnectionContainer(parentId: string): Konva.Group | null {
		const parentNode = this.canvas.elementManager.getElementInstance?.(parentId)?.getNode()
		if (!(parentNode instanceof Konva.Group)) return null

		const cachedContainer = this.localConnectionContainers.get(parentId)
		if (cachedContainer && cachedContainer.getParent() === parentNode) {
			this.syncLocalConnectionContainerTransform(cachedContainer, parentNode)
			this.placeLocalConnectionContainer(parentNode, cachedContainer)
			return cachedContainer
		}
		if (cachedContainer) {
			this.destroyLocalConnectionContainer(parentId)
		}

		const container = new Konva.Group({
			name: LOCAL_CONNECTION_CONTAINER_NAME,
			listening: true,
		})
		container.setAttr("connectionLocalParentId", parentId)
		this.syncLocalConnectionContainerTransform(container, parentNode)
		parentNode.add(container)
		this.placeLocalConnectionContainer(parentNode, container)
		this.localConnectionContainers.set(parentId, container)
		return container
	}

	private isVisibleConnectionContainer(parentNode: Konva.Group): boolean {
		return !!parentNode.findOne(".background") || typeof parentNode.clipFunc() === "function"
	}

	private resolveSharedParentId(connection: CanvasConnection): string | null {
		const sourceAncestorIds = this.getAncestorElementIds(connection.sourceElementId)
		if (sourceAncestorIds.length === 0) return null

		const targetAncestorIds = new Set(this.getAncestorElementIds(connection.targetElementId))
		return sourceAncestorIds.find((ancestorId) => targetAncestorIds.has(ancestorId)) ?? null
	}

	private getAncestorElementIds(elementId: string): string[] {
		const ancestorIds: string[] = []
		const visitedIds = new Set<string>()
		let currentId: string | null = this.resolveParentIdForRendering(elementId)

		while (currentId && !visitedIds.has(currentId)) {
			ancestorIds.push(currentId)
			visitedIds.add(currentId)
			currentId = this.resolveParentIdForRendering(currentId)
		}

		return ancestorIds
	}

	private resolveParentIdForRendering(elementId: string): string | null {
		const dragTargetParentId = this.canvas.frameManager?.getDragTargetParentId?.(elementId)
		if (dragTargetParentId !== undefined) return dragTargetParentId
		return this.canvas.elementManager.findParentIdForElement?.(elementId) ?? null
	}

	private syncLocalConnectionContainerTransform(
		container: Konva.Group,
		parentNode: Konva.Group,
	): void {
		const localTransform = parentNode
			.getAbsoluteTransform()
			.copy()
			.invert()
			.multiply(this.canvas.contentLayer.getAbsoluteTransform())
		container.setAttrs(localTransform.decompose())
	}

	private placeLocalConnectionContainer(parentNode: Konva.Group, container: Konva.Group): void {
		const backgroundNode = parentNode.findOne(".background")
		const hitNode = parentNode.findOne(".hit-area")
		const anchorNode = backgroundNode ?? hitNode
		if (!anchorNode) {
			container.moveToBottom()
			return
		}

		container.zIndex(Math.min(anchorNode.zIndex() + 1, parentNode.children.length - 1))
	}

	private resolveGeometry(connection: CanvasConnection): ResolvedConnectionGeometry | null {
		const sourceRect = this.canvas.geometryCacheManager.getElementBounds(
			connection.sourceElementId,
		)
		const targetRect = this.canvas.geometryCacheManager.getElementBounds(
			connection.targetElementId,
		)
		return resolveConnectionGeometry(sourceRect, targetRect)
	}

	private createGlobalSlotKey(connectionId: string): string {
		return `global:${connectionId}`
	}

	private createLocalSlotKey(parentId: string, connectionId: string): string {
		return `local:${parentId}:${connectionId}`
	}

	private destroyStaleConnectionNodes(desiredSlotKeys: Set<string>): void {
		this.renderedNodes.forEach((record, slotKey) => {
			if (desiredSlotKeys.has(slotKey)) return
			record.node.destroy()
			this.renderedNodes.delete(slotKey)
		})
	}

	private destroyAllConnectionNodes(): void {
		this.renderedNodes.forEach((record) => record.node.destroy())
		this.renderedNodes.clear()
	}

	private destroyUnusedLocalConnectionContainers(desiredParentIds: Set<string>): void {
		Array.from(this.localConnectionContainers.keys()).forEach((parentId) => {
			if (desiredParentIds.has(parentId)) return
			this.destroyLocalConnectionContainer(parentId)
		})
	}

	private destroyLocalConnectionContainer(parentId: string): void {
		const localSlotPrefix = `local:${parentId}:`
		this.renderedNodes.forEach((record, slotKey) => {
			if (!slotKey.startsWith(localSlotPrefix)) return
			record.node.destroy()
			this.renderedNodes.delete(slotKey)
		})

		const container = this.localConnectionContainers.get(parentId)
		if (!container) return
		container.destroy()
		this.localConnectionContainers.delete(parentId)
	}

	private bindHitPathEvents(path: Konva.Path, connectionId: string): void {
		path.on("mouseenter", () => {
			if (!this.canSelectConnections()) return
			this.cancelPendingHoverLeave(connectionId)
			this.hoveredConnectionIds.add(connectionId)
			this.canvas.cursorManager.setTemporary("pointer")
			this.applyInteractiveLineStyle(connectionId, "hover")
			this.showDeleteAction(connectionId)
		})
		path.on("mouseleave", () => {
			this.scheduleHoverLeave(connectionId)
		})
		path.on("mousedown touchstart", (event) => {
			if (!this.canSelectConnections()) return
			if (!this.isPrimaryInteraction(event)) return

			event.cancelBubble = true
			event.evt?.preventDefault?.()
			event.evt?.stopPropagation?.()
			const shouldToggle = this.isMultiSelectInteraction(event)
			this.canvas.connectionManager.selectConnection(connectionId, {
				append: shouldToggle,
				toggle: shouldToggle,
			})
		})
	}

	private applyInteractiveLineStyle(connectionId: string, state: "idle" | "hover"): void {
		this.applyLineStyleToRenderedConnection(connectionId)
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ConnectionRenderer",
			reason: `connection-${state}`,
			priority: "input",
		})
	}

	private showDeleteAction(connectionId: string): void {
		const geometry = this.renderedConnectionGeometries.get(connectionId)
		if (!geometry) return
		this.deleteActionRenderer.show(connectionId, geometry, this.getSafeStageScale())
	}

	private syncDeleteAction(): void {
		const connectionId = Array.from(this.hoveredConnectionIds).at(-1)
		if (!connectionId) {
			this.deleteActionRenderer.hide()
			return
		}

		const geometry = this.renderedConnectionGeometries.get(connectionId)
		if (!geometry) {
			this.deleteActionRenderer.hide()
			return
		}
		this.deleteActionRenderer.show(connectionId, geometry, this.getSafeStageScale())
	}

	private handleDeleteActionPointerEnter(connectionId: string): void {
		if (!this.canSelectConnections()) return
		this.cancelPendingHoverLeave(connectionId)
		this.hoveredConnectionIds.add(connectionId)
		this.canvas.cursorManager.setTemporary("pointer")
		this.applyInteractiveLineStyle(connectionId, "hover")
	}

	private handleDeleteActionPointerLeave(connectionId: string): void {
		this.scheduleHoverLeave(connectionId)
	}

	private applyLineStyleToRenderedConnection(connectionId: string): void {
		this.renderedNodes.forEach((record) => {
			if (record.node.getAttr("connectionId") !== connectionId) return

			const visualPath = record.node.findOne(`.${CONNECTION_VISUAL_PATH_NAME}`)
			if (!(visualPath instanceof Konva.Path)) return

			this.applyLineStyle(
				visualPath,
				this.resolveLineStyle(
					connectionId,
					this.canvas.connectionManager.isConnectionSelected(connectionId) ||
						this.highlightedConnectionIds.has(connectionId),
				),
			)
		})
	}

	private resolveLineStyle(connectionId: string, selected: boolean): ConnectionLineStyle {
		if (selected) return CONNECTION_SELECTED_LINE_STYLE
		return this.hoveredConnectionIds.has(connectionId)
			? CONNECTION_HOVER_LINE_STYLE
			: CONNECTION_LINE_STYLE
	}

	private scheduleHoverLeave(connectionId: string): void {
		this.cancelPendingHoverLeave(connectionId)
		const frameId = this.requestAnimationFrame(() => {
			this.pendingHoverLeaveFrameIds.delete(connectionId)
			this.hoveredConnectionIds.delete(connectionId)
			if (this.hoveredConnectionIds.size === 0) {
				this.canvas.cursorManager.restoreToolCursor()
			}
			this.applyInteractiveLineStyle(connectionId, "idle")
			this.syncDeleteAction()
		})
		this.pendingHoverLeaveFrameIds.set(connectionId, frameId)
	}

	private cancelPendingHoverLeave(connectionId: string): void {
		const frameId = this.pendingHoverLeaveFrameIds.get(connectionId)
		if (frameId === undefined) return
		this.cancelAnimationFrame(frameId)
		this.pendingHoverLeaveFrameIds.delete(connectionId)
	}

	private pruneConnectionHoverState(connectionIds: Set<string>): void {
		let removedHoveredConnection = false
		Array.from(this.hoveredConnectionIds).forEach((connectionId) => {
			if (connectionIds.has(connectionId)) return
			this.hoveredConnectionIds.delete(connectionId)
			removedHoveredConnection = true
		})
		Array.from(this.pendingHoverLeaveFrameIds.keys()).forEach((connectionId) => {
			if (connectionIds.has(connectionId)) return
			this.cancelPendingHoverLeave(connectionId)
		})
		if (removedHoveredConnection && this.hoveredConnectionIds.size === 0) {
			this.canvas.cursorManager.restoreToolCursor()
		}
		if (removedHoveredConnection) {
			this.syncDeleteAction()
		}
	}

	private clearConnectionHoverState(options: { restoreCursor: boolean }): void {
		const hadHoverState =
			this.hoveredConnectionIds.size > 0 || this.pendingHoverLeaveFrameIds.size > 0
		Array.from(this.pendingHoverLeaveFrameIds.values()).forEach((frameId) => {
			this.cancelAnimationFrame(frameId)
		})
		this.pendingHoverLeaveFrameIds.clear()
		this.hoveredConnectionIds.clear()
		this.deleteActionRenderer.hide()
		if (hadHoverState && options.restoreCursor) {
			this.canvas.cursorManager.restoreToolCursor()
		}
	}

	private pruneRenderedConnectionGeometries(desiredConnectionIds: Set<string>): void {
		Array.from(this.renderedConnectionGeometries.keys()).forEach((connectionId) => {
			if (desiredConnectionIds.has(connectionId)) return
			this.renderedConnectionGeometries.delete(connectionId)
		})
	}

	private applyLineStyle(path: Konva.Path, style: ConnectionLineStyle): void {
		const scale = this.getSafeStageScale()
		path.setAttrs({
			stroke: style.stroke,
			strokeWidth: resolveConnectionCanvasStrokeWidth(style.strokeWidth, scale),
			opacity: style.opacity,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur / scale,
			shadowOpacity: style.shadowOpacity,
		})
	}

	private canSelectConnections(): boolean {
		return this.canvas.permissionManager.canUseSelectionToolAffordance()
	}

	private isPrimaryInteraction(event: Konva.KonvaEventObject<Event>): boolean {
		const nativeEvent = event.evt
		if ("button" in nativeEvent && nativeEvent.button !== 0) {
			return false
		}
		return true
	}

	private isMultiSelectInteraction(event: Konva.KonvaEventObject<Event>): boolean {
		const nativeEvent = event.evt as Partial<
			Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">
		>
		return (
			nativeEvent.metaKey === true ||
			nativeEvent.ctrlKey === true ||
			nativeEvent.shiftKey === true
		)
	}

	private getSafeStageScale(): number {
		const scale = this.canvas.stage.scaleX()
		return Number.isFinite(scale) && scale > 0 ? scale : 1
	}

	private requestAnimationFrame(callback: FrameRequestCallback): number {
		if (typeof requestAnimationFrame === "function") {
			return requestAnimationFrame(callback)
		}
		return window.setTimeout(() => callback(Date.now()), 16)
	}

	private cancelAnimationFrame(frameId: number): void {
		if (typeof cancelAnimationFrame === "function") {
			cancelAnimationFrame(frameId)
			return
		}
		window.clearTimeout(frameId)
	}
}
