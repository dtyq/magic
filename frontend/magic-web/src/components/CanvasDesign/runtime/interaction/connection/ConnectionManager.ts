import type { Canvas } from "../../core/Canvas"
import { getActiveContent, updateContent } from "../../document/elementContent"
import type { CanvasDocumentPatch } from "../../document/patch"
import {
	ElementTypeEnum,
	type CanvasConnection,
	type CanvasDocument,
	type VideoEditElementContent,
} from "../../document/types"
import type { Rect } from "../../shared/ids"
import { generateConnectionId } from "../../shared/ids"
import { ConnectionHitTestService } from "./ConnectionHitTestService"
import { ConnectionRenderer } from "./ConnectionRenderer"
import { ConnectionStore } from "./ConnectionStore"
import { collectConnectedVideoEditInputs } from "./connectedInputSources"

export class ConnectionManager {
	private canvas: Canvas
	private store = new ConnectionStore()
	/** 仅用于运行时预览的连接，元素转正后才允许进入文档持久化。 */
	private runtimeConnectionIds = new Set<string>()
	private selectedConnectionIds: Set<string> = new Set()
	private selectedElementIdsForConnectionHighlight: Set<string> = new Set()
	private renderer: ConnectionRenderer
	private hitTester: ConnectionHitTestService
	private unsubscribers: Array<() => void> = []
	private pendingRerenderFrameId: number | null = null
	private pendingGeometryInvalidationIds: Set<string> = new Set()

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.renderer = new ConnectionRenderer({ canvas: this.canvas })
		this.hitTester = new ConnectionHitTestService({ canvas: this.canvas })
		this.setupEventListeners()
	}

	public loadDocument(doc: CanvasDocument): void {
		this.runtimeConnectionIds.clear()
		this.store.load(this.filterExistingConnections(doc.connections ?? []))
		this.syncVideoEditInputs(
			this.store.getConnections().map((connection) => connection.targetElementId),
		)
		this.hitTester.invalidateAll()
		this.selectedElementIdsForConnectionHighlight.clear()
		this.clearSelectedConnections({ render: false })
		this.rerenderNow()
	}

	public exportConnections(): CanvasConnection[] {
		return this.store
			.getConnections()
			.filter((connection) => this.canPersistConnection(connection))
	}

	public getConnections(): CanvasConnection[] {
		return this.store.getConnections()
	}

	public hasConnections(): boolean {
		return !this.store.isEmpty()
	}

	public getSelectedConnectionId(): string | null {
		return this.getSelectedConnectionIds()[0] ?? null
	}

	public getSelectedConnectionIds(): string[] {
		return Array.from(this.selectedConnectionIds).filter((connectionId) =>
			this.store.hasConnectionId(connectionId),
		)
	}

	public hasSelectedConnection(): boolean {
		return this.getSelectedConnectionIds().length > 0
	}

	public isConnectionSelected(connectionId: string): boolean {
		return this.selectedConnectionIds.has(connectionId)
	}

	public getUpstreamConnections(elementId: string): CanvasConnection[] {
		return this.store.getUpstreamConnections(elementId)
	}

	public getDownstreamConnections(elementId: string): CanvasConnection[] {
		return this.store.getDownstreamConnections(elementId)
	}

	public hasConnection(sourceElementId: string, targetElementId: string): boolean {
		return this.store.hasConnection(sourceElementId, targetElementId)
	}

	public hasReverseConnection(sourceElementId: string, targetElementId: string): boolean {
		return this.store.hasReverseConnection(sourceElementId, targetElementId)
	}

	public findConnectionsInBox(box: Rect): string[] {
		return this.hitTester.findConnectionsInBox(this.getRenderableConnections(), box)
	}

	public exportDocumentPatch(options: {
		changedConnectionIds?: string[]
		deletedConnectionIds?: string[]
	}): Pick<
		CanvasDocumentPatch,
		"connectionUpserts" | "deletedConnectionIds" | "changedConnectionIds"
	> {
		const connectionUpserts = this.store
			.getConnectionsByIds(options.changedConnectionIds ?? [])
			.filter((connection) => this.canPersistConnection(connection))
		const changedConnectionIds = connectionUpserts.map((connection) => connection.id)
		return {
			connectionUpserts,
			deletedConnectionIds: options.deletedConnectionIds ?? [],
			changedConnectionIds,
		}
	}

	public addConnection(
		connection: Omit<CanvasConnection, "id"> & { id?: string },
	): string | null {
		if (connection.sourceElementId === connection.targetElementId) {
			return null
		}
		if (
			!this.hasElement(connection.sourceElementId) ||
			!this.hasElement(connection.targetElementId)
		) {
			return null
		}
		if (!this.canPersistConnection(connection)) return null

		const id = connection.id ?? generateConnectionId()
		if (this.store.hasConnectionId(id)) {
			return null
		}
		if (this.hasConnection(connection.sourceElementId, connection.targetElementId)) {
			return null
		}
		if (this.hasReverseConnection(connection.sourceElementId, connection.targetElementId)) {
			return null
		}

		this.store.add({
			id,
			sourceElementId: connection.sourceElementId,
			targetElementId: connection.targetElementId,
		})
		this.hitTester.invalidateConnections([id])
		this.syncVideoEditInputs([connection.targetElementId])
		this.emitChangeAndRender({ changedConnectionIds: [id] })
		return id
	}

	public connectElements(options: { sourceElementId: string; targetElementId: string }):
		| { status: "created"; connectionId: string }
		| {
				status: "invalid"
				reason:
					| "self"
					| "missing-element"
					| "temporary-element"
					| "already-connected"
					| "reverse-existing"
		  } {
		const { sourceElementId, targetElementId } = options
		if (sourceElementId === targetElementId) {
			return { status: "invalid", reason: "self" }
		}
		if (!this.hasElement(sourceElementId) || !this.hasElement(targetElementId)) {
			return { status: "invalid", reason: "missing-element" }
		}
		if (!this.canPersistConnection({ sourceElementId, targetElementId })) {
			return { status: "invalid", reason: "temporary-element" }
		}

		if (this.hasConnection(sourceElementId, targetElementId)) {
			return { status: "invalid", reason: "already-connected" }
		}

		if (this.hasReverseConnection(sourceElementId, targetElementId)) {
			return { status: "invalid", reason: "reverse-existing" }
		}

		const id = generateConnectionId()
		this.store.add({
			id,
			sourceElementId,
			targetElementId,
		})
		this.hitTester.invalidateConnections([id])
		this.syncVideoEditInputs([targetElementId])
		this.emitChangeAndRender({ changedConnectionIds: [id] })
		return { status: "created", connectionId: id }
	}

	/** 创建仅运行时可见的连接，允许连接到临时元素，但不会写入 DSL。 */
	public connectRuntimeElements(options: { sourceElementId: string; targetElementId: string }):
		| { status: "created"; connectionId: string }
		| {
				status: "invalid"
				reason: "self" | "missing-element" | "already-connected" | "reverse-existing"
		  } {
		const { sourceElementId, targetElementId } = options
		if (sourceElementId === targetElementId) return { status: "invalid", reason: "self" }
		if (!this.hasElement(sourceElementId) || !this.hasElement(targetElementId)) {
			return { status: "invalid", reason: "missing-element" }
		}
		if (this.hasConnection(sourceElementId, targetElementId)) {
			return { status: "invalid", reason: "already-connected" }
		}
		if (this.hasReverseConnection(sourceElementId, targetElementId)) {
			return { status: "invalid", reason: "reverse-existing" }
		}

		const connectionId = generateConnectionId()
		if (!this.store.add({ id: connectionId, sourceElementId, targetElementId })) {
			return { status: "invalid", reason: "already-connected" }
		}
		this.runtimeConnectionIds.add(connectionId)
		this.hitTester.invalidateConnections([connectionId])
		this.rerenderNow()
		return { status: "created", connectionId }
	}

	/** 将运行时连接升级为正式连接，并触发一次文档变更事件。 */
	public promoteRuntimeConnection(connectionId: string): boolean {
		if (!this.runtimeConnectionIds.delete(connectionId)) return false
		if (!this.store.hasConnectionId(connectionId)) return false
		this.hitTester.invalidateConnections([connectionId])
		this.emitChangeAndRender({ changedConnectionIds: [connectionId] })
		return true
	}

	/**
	 * 原子创建多条连接。先对整批边做完整预检，任意一条非法时不修改连接存储，
	 * 成功时只发出一次 connection:change。
	 */
	public connectElementsBatch(options: {
		edges: Array<{
			sourceElementId: string
			targetElementId: string
		}>
	}):
		| { status: "created"; connectionIds: string[] }
		| {
				status: "invalid"
				reason:
					| "empty"
					| "self"
					| "missing-element"
					| "temporary-element"
					| "already-connected"
					| "reverse-existing"
					| "duplicate"
		  } {
		const edges = options.edges
		if (edges.length === 0) return { status: "invalid", reason: "empty" }

		const plannedPairs = new Set<string>()
		for (const edge of edges) {
			const { sourceElementId, targetElementId } = edge
			if (sourceElementId === targetElementId) return { status: "invalid", reason: "self" }
			if (!this.hasElement(sourceElementId) || !this.hasElement(targetElementId)) {
				return { status: "invalid", reason: "missing-element" }
			}
			if (!this.canPersistConnection(edge)) {
				return { status: "invalid", reason: "temporary-element" }
			}

			const pair = `${sourceElementId}\u0000${targetElementId}`
			const reversePair = `${targetElementId}\u0000${sourceElementId}`
			if (plannedPairs.has(pair)) return { status: "invalid", reason: "duplicate" }
			if (plannedPairs.has(reversePair))
				return { status: "invalid", reason: "reverse-existing" }
			if (this.hasConnection(sourceElementId, targetElementId)) {
				return { status: "invalid", reason: "already-connected" }
			}
			if (this.hasReverseConnection(sourceElementId, targetElementId)) {
				return { status: "invalid", reason: "reverse-existing" }
			}
			plannedPairs.add(pair)
		}

		const connectionIds: string[] = []
		for (const edge of edges) {
			const id = generateConnectionId()
			connectionIds.push(id)
			this.store.add({
				id,
				sourceElementId: edge.sourceElementId,
				targetElementId: edge.targetElementId,
			})
		}
		this.hitTester.invalidateConnections(connectionIds)
		this.syncVideoEditInputs(edges.map((edge) => edge.targetElementId))
		this.emitChangeAndRender({ changedConnectionIds: connectionIds })
		return { status: "created", connectionIds }
	}

	public replaceConnectionSelection(
		connectionIds: string[],
		options?: { autoFocus?: boolean },
	): void {
		this.updateSelectedConnectionIds(new Set(this.filterExistingConnectionIds(connectionIds)), {
			autoFocus: options?.autoFocus ?? true,
			render: true,
		})
	}

	public selectConnections(
		connectionIds: string[],
		options?: { append?: boolean; autoFocus?: boolean },
	): void {
		const validConnectionIds = this.filterExistingConnectionIds(connectionIds)
		const nextConnectionIds = options?.append
			? new Set([...this.selectedConnectionIds, ...validConnectionIds])
			: new Set(validConnectionIds)

		this.updateSelectedConnectionIds(nextConnectionIds, {
			autoFocus: options?.autoFocus ?? true,
			render: true,
		})
	}

	public selectConnection(
		connectionId: string,
		options?: { autoFocus?: boolean; append?: boolean; toggle?: boolean },
	): boolean {
		if (!this.store.hasConnectionId(connectionId)) {
			return false
		}

		const shouldAppend = options?.append === true || options?.toggle === true
		if (!shouldAppend) {
			this.canvas.selectionManager?.deselectAll?.()
		}

		const nextConnectionIds =
			shouldAppend || options?.toggle
				? new Set(this.selectedConnectionIds)
				: new Set<string>()
		if (options?.toggle && nextConnectionIds.has(connectionId)) {
			nextConnectionIds.delete(connectionId)
		} else {
			nextConnectionIds.add(connectionId)
		}

		this.updateSelectedConnectionIds(nextConnectionIds, {
			autoFocus: options?.autoFocus ?? true,
			render: true,
		})
		return true
	}

	public deselectConnection(connectionId?: string): void {
		if (!connectionId) {
			this.clearSelectedConnections({ render: true })
			return
		}

		if (!this.selectedConnectionIds.has(connectionId)) return
		const nextConnectionIds = new Set(this.selectedConnectionIds)
		nextConnectionIds.delete(connectionId)
		this.updateSelectedConnectionIds(nextConnectionIds, { render: true, autoFocus: false })
	}

	public removeConnection(connectionId: string): boolean {
		return this.removeConnections([connectionId]).length > 0
	}

	public deleteSelectedConnection(): boolean {
		return this.deleteSelectedConnections()
	}

	public deleteSelectedConnections(): boolean {
		const selectedConnectionIds = this.getSelectedConnectionIds()
		if (selectedConnectionIds.length === 0) return false
		return this.removeConnections(selectedConnectionIds).length > 0
	}

	public removeConnections(
		connectionIds: string[],
		options?: { emitChange?: boolean },
	): string[] {
		const affectedTargetElementIds = this.store
			.getConnectionsByIds(connectionIds)
			.map((connection) => connection.targetElementId)
		const deletedConnectionIds = this.store.removeConnections(connectionIds)
		if (deletedConnectionIds.length === 0) {
			return []
		}
		deletedConnectionIds.forEach((connectionId) =>
			this.runtimeConnectionIds.delete(connectionId),
		)

		this.hitTester.invalidateConnections(deletedConnectionIds)
		this.removeSelectedConnectionIds(deletedConnectionIds, { render: false })
		this.syncVideoEditInputs(affectedTargetElementIds)
		if (options?.emitChange === false) {
			this.rerenderNow()
			return deletedConnectionIds
		}
		this.emitChangeAndRender({ deletedConnectionIds })
		return deletedConnectionIds
	}

	public removeConnectionsByElementId(
		elementId: string,
		options?: { emitChange?: boolean },
	): void {
		const connectionIds = this.store.getConnectionIdsByElementId(elementId)
		const affectedTargetElementIds = this.store
			.getConnectionsByIds(connectionIds)
			.map((connection) => connection.targetElementId)
		const deletedConnectionIds = this.store.removeConnections(connectionIds)
		if (deletedConnectionIds.length === 0) {
			return
		}
		deletedConnectionIds.forEach((connectionId) =>
			this.runtimeConnectionIds.delete(connectionId),
		)

		this.hitTester.invalidateConnections(deletedConnectionIds)
		this.removeSelectedConnectionIds(deletedConnectionIds, { render: false })
		this.syncVideoEditInputs(affectedTargetElementIds)
		if (options?.emitChange === false) {
			this.rerenderNow()
			return
		}
		this.emitChangeAndRender({ deletedConnectionIds })
	}

	public clear(options?: { emitChange?: boolean }): void {
		const affectedTargetElementIds = this.store
			.getConnections()
			.map((connection) => connection.targetElementId)
		this.clearSelectedConnections({ render: false })
		if (this.store.isEmpty()) {
			this.renderer.clear()
			return
		}

		const deletedConnectionIds = this.store.getConnectionIds()
		this.store.clear()
		this.runtimeConnectionIds.clear()
		this.hitTester.invalidateAll()
		this.syncVideoEditInputs(affectedTargetElementIds)
		if (options?.emitChange === false) {
			this.renderer.clear()
			return
		}
		this.emitChangeAndRender({ deletedConnectionIds })
	}

	public rerender(): void {
		this.renderer.render(this.getRenderableConnections(), {
			selectedConnectionIds: this.getSelectedConnectionIds(),
			highlightedConnectionIds: this.getConnectionIdsForHighlightedElements(),
		})
	}

	public destroy(): void {
		this.cancelScheduledRerender()
		this.pendingGeometryInvalidationIds.clear()
		this.unsubscribers.forEach((unsubscribe) => unsubscribe())
		this.unsubscribers = []
		this.renderer.destroy()
		this.store.clear()
		this.runtimeConnectionIds.clear()
		this.hitTester.invalidateAll()
		this.selectedConnectionIds.clear()
		this.selectedElementIdsForConnectionHighlight.clear()
	}

	private setupEventListeners(): void {
		const rerender = () => {
			this.rerenderNow()
		}
		const rerenderAfterConnectionChange = (event: {
			data: { changedConnectionIds?: string[]; deletedConnectionIds?: string[] }
		}) => {
			const changedConnectionIds = event.data.changedConnectionIds ?? []
			const deletedConnectionIds = event.data.deletedConnectionIds ?? []
			if (changedConnectionIds.length > 0 || deletedConnectionIds.length > 0) {
				this.hitTester.invalidateConnections([
					...changedConnectionIds,
					...deletedConnectionIds,
				])
			} else {
				this.hitTester.invalidateAll()
			}
			this.rerenderNow()
		}
		const rerenderAfterElementGeometryChange = (event: { data: { elementId: string } }) => {
			this.hitTester.invalidateElements([event.data.elementId])
			this.rerenderNow()
		}
		const rerenderAfterBatchElementUpdate = (event: { data?: { elementIds?: string[] } }) => {
			// ElementManager coalesces a batch into one event. Invalidate only the
			// affected endpoint geometry when the producer provides IDs; older callers
			// may still emit undefined, which conservatively keeps the old full flush.
			const elementIds = event.data?.elementIds ?? []
			if (elementIds.length > 0) this.hitTester.invalidateElements(elementIds)
			else this.hitTester.invalidateAll()
			this.rerenderNow()
		}
		const clearHoverAndRerender = () => {
			this.renderer.clearHover()
			this.rerenderNow()
		}
		const scheduleTransformRerender = (event: { data: { elementIds?: string[] } }) => {
			this.scheduleRerender({
				invalidateElementIds: event.data.elementIds,
			})
		}
		const clearSelection = () => {
			this.selectedElementIdsForConnectionHighlight.clear()
			this.clearSelectedConnections({ render: false })
			this.rerenderNow()
		}
		const syncHighlightedConnectionsFromElementSelection = (event: {
			data: { elementIds: string[] }
		}) => {
			// 元素选中派生出关联线高亮，但不写入 connection 的真实选区。
			this.selectedElementIdsForConnectionHighlight = new Set(event.data.elementIds)
			this.rerenderNow()
		}
		const clearHighlightedConnectionsFromElementSelection = (event: {
			data?: { elementIds?: string[] }
		}) => {
			const elementIds = event.data?.elementIds
			if (!elementIds?.length) {
				this.selectedElementIdsForConnectionHighlight.clear()
			} else {
				elementIds.forEach((elementId) =>
					this.selectedElementIdsForConnectionHighlight.delete(elementId),
				)
			}
			this.rerenderNow()
		}

		this.unsubscribers.push(
			this.canvas.eventEmitter.on("connection:change", rerenderAfterConnectionChange),
			this.canvas.eventEmitter.on("document:loaded", rerender),
			this.canvas.eventEmitter.on("document:restored", rerender),
			this.canvas.eventEmitter.on("permission:changed", clearHoverAndRerender),
			this.canvas.eventEmitter.on("tool:change", clearHoverAndRerender),
			this.canvas.eventEmitter.on("canvas:clear", clearSelection),
			this.canvas.eventEmitter.on(
				"element:select",
				syncHighlightedConnectionsFromElementSelection,
			),
			this.canvas.eventEmitter.on(
				"element:deselect",
				clearHighlightedConnectionsFromElementSelection,
			),
			this.canvas.eventEmitter.on("element:updated", rerenderAfterElementGeometryChange),
			this.canvas.eventEmitter.on("element:rerendered", rerenderAfterElementGeometryChange),
			this.canvas.eventEmitter.on("element:batchupdated", rerenderAfterBatchElementUpdate),
			this.canvas.eventEmitter.on("elements:transform:dragmove", scheduleTransformRerender),
			this.canvas.eventEmitter.on(
				"elements:transform:anchorDragmove",
				scheduleTransformRerender,
			),
			this.canvas.eventEmitter.on("viewport:scale", () => {
				if (!this.hasConnections()) return
				this.scheduleRerender()
			}),
			this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
				this.removeConnectionsByElementId(data.elementId, { emitChange: false })
			}),
		)
	}

	private rerenderNow(): void {
		this.cancelScheduledRerender()
		this.flushPendingGeometryInvalidations()
		this.syncSelectedConnectionWithData()
		this.rerender()
	}

	private scheduleRerender(options?: { invalidateElementIds?: string[] }): void {
		this.trackPendingGeometryInvalidations(options?.invalidateElementIds)

		if (this.pendingRerenderFrameId !== null) {
			return
		}

		if (typeof requestAnimationFrame !== "function") {
			this.flushScheduledRerender()
			return
		}

		this.pendingRerenderFrameId = requestAnimationFrame(() => {
			this.pendingRerenderFrameId = null
			this.flushScheduledRerender()
		})
	}

	private flushScheduledRerender(): void {
		this.flushPendingGeometryInvalidations()
		this.syncSelectedConnectionWithData()
		this.rerender()
	}

	private trackPendingGeometryInvalidations(elementIds?: string[]): void {
		elementIds?.forEach((elementId) => {
			if (elementId) {
				this.pendingGeometryInvalidationIds.add(elementId)
			}
		})
	}

	private flushPendingGeometryInvalidations(): void {
		if (this.pendingGeometryInvalidationIds.size === 0) {
			return
		}

		this.canvas.geometryCacheManager.invalidateElements(
			Array.from(this.pendingGeometryInvalidationIds),
		)
		this.hitTester.invalidateElements(this.pendingGeometryInvalidationIds)
		this.pendingGeometryInvalidationIds.clear()
	}

	private cancelScheduledRerender(): void {
		if (this.pendingRerenderFrameId === null) {
			return
		}

		if (typeof cancelAnimationFrame === "function") {
			cancelAnimationFrame(this.pendingRerenderFrameId)
		}
		this.pendingRerenderFrameId = null
	}

	private clearSelectedConnections(options: { render: boolean }): void {
		this.updateSelectedConnectionIds(new Set(), {
			render: options.render,
			autoFocus: false,
		})
	}

	private getConnectionIdsForHighlightedElements(): string[] {
		const connectionIds = new Set<string>()
		this.selectedElementIdsForConnectionHighlight.forEach((elementId) => {
			this.store.getConnectionIdsByElementId(elementId).forEach((connectionId) => {
				connectionIds.add(connectionId)
			})
		})
		return Array.from(connectionIds)
	}

	private removeSelectedConnectionIds(
		connectionIds: string[],
		options: { render: boolean },
	): void {
		if (connectionIds.length === 0 || this.selectedConnectionIds.size === 0) return

		const deletedConnectionIdSet = new Set(connectionIds)
		const nextConnectionIds = new Set(
			Array.from(this.selectedConnectionIds).filter(
				(connectionId) => !deletedConnectionIdSet.has(connectionId),
			),
		)
		this.updateSelectedConnectionIds(nextConnectionIds, {
			render: options.render,
			autoFocus: false,
		})
	}

	private syncSelectedConnectionWithData(): void {
		if (this.selectedConnectionIds.size === 0) return
		const nextConnectionIds = new Set(
			Array.from(this.selectedConnectionIds).filter((connectionId) =>
				this.store.hasConnectionId(connectionId),
			),
		)
		this.updateSelectedConnectionIds(nextConnectionIds, {
			render: false,
			autoFocus: false,
		})
	}

	private filterExistingConnectionIds(connectionIds: string[]): string[] {
		const result: string[] = []
		const seenConnectionIds = new Set<string>()

		for (const connectionId of connectionIds) {
			if (!this.store.hasConnectionId(connectionId) || seenConnectionIds.has(connectionId)) {
				continue
			}
			result.push(connectionId)
			seenConnectionIds.add(connectionId)
		}

		return result
	}

	private updateSelectedConnectionIds(
		nextConnectionIds: Set<string>,
		options?: { render?: boolean; autoFocus?: boolean },
	): void {
		const normalizedNextConnectionIds = new Set(
			this.filterExistingConnectionIds(Array.from(nextConnectionIds)),
		)
		if (
			this.areConnectionIdSetsEqual(this.selectedConnectionIds, normalizedNextConnectionIds)
		) {
			return
		}

		const previousConnectionIds = this.selectedConnectionIds
		const addedConnectionIds = Array.from(normalizedNextConnectionIds).filter(
			(connectionId) => !previousConnectionIds.has(connectionId),
		)
		const removedConnectionIds = Array.from(previousConnectionIds).filter(
			(connectionId) => !normalizedNextConnectionIds.has(connectionId),
		)

		this.selectedConnectionIds = normalizedNextConnectionIds
		removedConnectionIds.forEach((connectionId) => {
			this.canvas.eventEmitter.emit({
				type: "connection:deselect",
				data: { connectionId },
			})
		})
		addedConnectionIds.forEach((connectionId) => {
			this.canvas.eventEmitter.emit({
				type: "connection:select",
				data: { connectionId },
			})
		})
		this.canvas.eventEmitter.emit({
			type: "connection:selection:change",
			data: {
				selectedConnectionIds: Array.from(this.selectedConnectionIds),
				addedConnectionIds,
				removedConnectionIds,
			},
		})

		if (options?.render !== false) {
			this.rerenderNow()
		}
		if (options?.autoFocus === true) {
			this.focusCanvasContainer()
		}
	}

	private areConnectionIdSetsEqual(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false
		for (const connectionId of a) {
			if (!b.has(connectionId)) return false
		}
		return true
	}

	private emitChangeAndRender(options?: {
		changedConnectionIds?: string[]
		deletedConnectionIds?: string[]
	}): void {
		const connections = this.exportConnections()
		this.canvas.eventEmitter.emit({
			type: "connection:change",
			data: {
				connections,
				changedConnectionIds: options?.changedConnectionIds,
				deletedConnectionIds: options?.deletedConnectionIds,
			},
		})
	}

	/**
	 * Reconciles persisted VideoEdit order with the current connection graph.
	 * Existing connected videos keep their user order; new connections append.
	 */
	private syncVideoEditInputs(targetElementIds: Iterable<string>): void {
		const elementManager = this.canvas.elementManager
		const uniqueTargetIds = new Set(targetElementIds)
		uniqueTargetIds.forEach((targetElementId) => {
			const target = elementManager.getElementData(targetElementId)
			if (!target || target.type !== ElementTypeEnum.VideoEdit) return

			const content = getActiveContent<VideoEditElementContent>(target)
			if (!content) return
			const connected = collectConnectedVideoEditInputs(this.canvas, targetElementId)
			const connectedSet = new Set(connected.videoElementIds)
			const nextVideoSequence: string[] = []
			;(content.videoSequence ?? []).forEach((elementId) => {
				if (connectedSet.has(elementId) && !nextVideoSequence.includes(elementId)) {
					nextVideoSequence.push(elementId)
				}
			})
			connected.videoElementIds.forEach((elementId) => {
				if (!nextVideoSequence.includes(elementId)) nextVideoSequence.push(elementId)
			})
			const connectedAudioSet = new Set(connected.audioElementIds)
			const nextAudioSequence: string[] = []
			;(content.audioSequence ?? []).forEach((elementId) => {
				if (connectedAudioSet.has(elementId) && !nextAudioSequence.includes(elementId)) {
					nextAudioSequence.push(elementId)
				}
			})
			connected.audioElementIds.forEach((elementId) => {
				if (!nextAudioSequence.includes(elementId)) nextAudioSequence.push(elementId)
			})

			const currentSequence = content.videoSequence ?? []
			const currentAudioSequence = content.audioSequence ?? []
			if (
				currentSequence.length === nextVideoSequence.length &&
				currentSequence.every(
					(elementId, index) => elementId === nextVideoSequence[index],
				) &&
				currentAudioSequence.length === nextAudioSequence.length &&
				currentAudioSequence.every(
					(elementId, index) => elementId === nextAudioSequence[index],
				)
			) {
				return
			}

			const next = updateContent(target, target.activeContentId ?? undefined, {
				videoSequence: nextVideoSequence,
				audioSequence: nextAudioSequence,
			})
			if (next !== target) elementManager.update(targetElementId, { contents: next.contents })
		})
	}

	/** Reconciles every VideoEdit after element and connection documents are loaded. */
	public normalizeVideoEditInputs(): void {
		this.syncVideoEditInputs(this.canvas.elementManager.getAllElementIds())
	}

	private getRenderableConnections(): CanvasConnection[] {
		return this.store.getConnections().filter((connection) => {
			return (
				(this.runtimeConnectionIds.has(connection.id) ||
					this.canPersistConnection(connection)) &&
				this.isElementVisible(connection.sourceElementId) &&
				this.isElementVisible(connection.targetElementId)
			)
		})
	}

	private filterExistingConnections(connections: CanvasConnection[]): CanvasConnection[] {
		return connections.filter((connection) => {
			return (
				connection.sourceElementId !== connection.targetElementId &&
				this.hasElement(connection.sourceElementId) &&
				this.hasElement(connection.targetElementId) &&
				this.canPersistConnection(connection)
			)
		})
	}

	private canPersistConnection(
		connection: Pick<CanvasConnection, "sourceElementId" | "targetElementId">,
	): boolean {
		return (
			this.canvas.elementManager.canParticipateInDocumentRelations(
				connection.sourceElementId,
			) &&
			this.canvas.elementManager.canParticipateInDocumentRelations(connection.targetElementId)
		)
	}

	private hasElement(elementId: string): boolean {
		return !!this.canvas.elementManager.getElementData(elementId)
	}

	private isElementVisible(elementId: string): boolean {
		return this.canvas.elementManager.isElementVisibleInDataTree(elementId)
	}

	private focusCanvasContainer(): void {
		const stageWithContainer = this.canvas.stage as typeof this.canvas.stage & {
			container?: () => HTMLElement | undefined
		}
		const container = stageWithContainer.container?.()
		if (!container || container.tabIndex < 0) return

		requestAnimationFrame(() => {
			container.focus()
		})
	}
}
