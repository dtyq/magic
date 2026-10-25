import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type FrameElement,
	type GroupElement,
	type LayerElement,
	type VideoEditElementContent,
} from "../../document/types"
import { getActiveContent } from "../../document/elementContent"
import { sortCanvasElementsByZIndexStable } from "../../document/elementIndex"

export type ConnectedSourceOrigin = "connected-element" | "frame-descendant"

/**
 * A source element resolved from the persisted connection graph.
 *
 * `connectionId` remains the stable candidate identity used by existing editor
 * selection code. The root fields are explicit provenance for consumers such as
 * Storyboard, which need to group Frame descendants without parsing that ID.
 */
export interface ConnectedInputSourceElement {
	connectionId: string
	sourceElementId: string
	element: LayerElement
	rootConnectionId?: string
	rootSourceElementId?: string
	origin?: ConnectedSourceOrigin
	depth?: number
}

export interface ConnectedSourceCollectionConfig {
	/** direct keeps first-level upstream behavior; upstream traverses ancestors. */
	mode: "direct" | "upstream"
	/** Maximum connection-edge depth in upstream mode. */
	maxDepth: number
}

const FRAME_SOURCE_ID_PREFIX = "frame-source"
const UPSTREAM_SOURCE_ID_PREFIX = "upstream-source"

const DEFAULT_SOURCE_COLLECTION_CONFIG: ConnectedSourceCollectionConfig = {
	mode: "upstream",
	maxDepth: Number.POSITIVE_INFINITY,
}

export function createConnectedFrameSourceId(
	connectionId: string,
	sourceElementId: string,
): string {
	return `${FRAME_SOURCE_ID_PREFIX}:${connectionId}:${sourceElementId}`
}

export function createConnectedUpstreamSourceId(
	targetElementId: string,
	sourceElementId: string,
): string {
	return `${UPSTREAM_SOURCE_ID_PREFIX}:${targetElementId}:${sourceElementId}`
}

export function isConnectedSourceConsumableElement(element: LayerElement): boolean {
	return (
		element.type === ElementTypeEnum.Text ||
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

function isConnectedSourceContainer(element: LayerElement): element is FrameElement | GroupElement {
	return element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group
}

/**
 * Recursively expands a connected Frame or Group into visible editor-consumable
 * descendants in stable back-to-front order. Frame and Group are containers;
 * they are not themselves source candidates.
 */
export function collectConnectedFrameSourceElements(
	connectionId: string,
	container: FrameElement | GroupElement,
	options?: {
		excludedElementIds?: Iterable<string>
		rootConnectionId?: string
		rootSourceElementId?: string
		depth?: number
	},
): ConnectedInputSourceElement[] {
	const result: ConnectedInputSourceElement[] = []
	const visitedElementIds = new Set<string>()
	const excludedElementIds = new Set(options?.excludedElementIds)
	const rootConnectionId = options?.rootConnectionId ?? connectionId
	const rootSourceElementId = options?.rootSourceElementId ?? container.id
	const depth = options?.depth ?? 1

	const collect = (elements: LayerElement[] | undefined): void => {
		for (const element of sortCanvasElementsByZIndexStable(elements ?? [])) {
			if (
				visitedElementIds.has(element.id) ||
				excludedElementIds.has(element.id) ||
				element.visible === false
			) {
				continue
			}
			visitedElementIds.add(element.id)

			if (element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group) {
				collect(element.children)
				continue
			}

			if (!isConnectedSourceConsumableElement(element)) continue
			result.push({
				connectionId: createConnectedFrameSourceId(connectionId, element.id),
				sourceElementId: element.id,
				element,
				rootConnectionId,
				rootSourceElementId,
				origin: "frame-descendant",
				depth,
			})
		}
	}

	collect(container.children)
	return result
}

function collectDirectConnectedSourceElements(
	canvas: Canvas,
	targetElementId: string,
): ConnectedInputSourceElement[] {
	if (!canvas.connectionManager?.getUpstreamConnections) return []
	const upstreamConnections = canvas.connectionManager.getUpstreamConnections(targetElementId)
	const result: ConnectedInputSourceElement[] = []
	const collectedSourceElementIds = new Set<string>()
	const directSourceElementIds = new Set(
		upstreamConnections.flatMap((connection) => {
			const sourceElement = canvas.elementManager.getElementData(connection.sourceElementId)
			return sourceElement && isConnectedSourceConsumableElement(sourceElement)
				? [sourceElement.id]
				: []
		}),
	)

	for (const connection of upstreamConnections) {
		const sourceElement = canvas.elementManager.getElementData(connection.sourceElementId)
		if (!sourceElement) continue

		if (isConnectedSourceConsumableElement(sourceElement)) {
			if (collectedSourceElementIds.has(sourceElement.id)) continue
			collectedSourceElementIds.add(sourceElement.id)
			result.push({
				connectionId: connection.id,
				sourceElementId: sourceElement.id,
				element: sourceElement,
				rootConnectionId: connection.id,
				rootSourceElementId: sourceElement.id,
				origin: "connected-element",
				depth: 1,
			})
			continue
		}

		if (!isConnectedSourceContainer(sourceElement)) continue

		for (const frameSource of collectConnectedFrameSourceElements(
			connection.id,
			sourceElement,
			{
				excludedElementIds: [targetElementId],
				rootConnectionId: connection.id,
				rootSourceElementId: sourceElement.id,
				depth: 1,
			},
		)) {
			// If the same element is directly connected as well, retain the more
			// explicit direct connection identity.
			if (
				directSourceElementIds.has(frameSource.sourceElementId) ||
				collectedSourceElementIds.has(frameSource.sourceElementId)
			) {
				continue
			}
			collectedSourceElementIds.add(frameSource.sourceElementId)
			result.push(frameSource)
		}
	}

	return result
}

interface CollectedSource {
	item: ConnectedInputSourceElement
	depth: number
	origin: ConnectedSourceOrigin
	order: number
}

function shouldReplaceCollectedSource(current: CollectedSource, next: CollectedSource): boolean {
	if (next.depth !== current.depth) return next.depth < current.depth
	if (next.origin !== current.origin) return next.origin === "connected-element"
	return false
}

/**
 * Breadth-first traversal from the target through upstream connections. A Frame
 * is expanded when reached, but its descendants are not traversed as graph
 * nodes. Cycles and diamond paths are bounded by source element identity.
 */
export function collectConnectedUpstreamSourceElements(
	canvas: Canvas,
	targetElementId: string,
	maxDepth: number,
): ConnectedInputSourceElement[] {
	const normalizedMaxDepth =
		maxDepth === Number.POSITIVE_INFINITY
			? Number.POSITIVE_INFINITY
			: Number.isFinite(maxDepth)
				? Math.max(1, Math.floor(maxDepth))
				: 1
	const queue: Array<{
		elementId: string
		depth: number
		rootConnectionId?: string
		rootSourceElementId?: string
	}> = [{ elementId: targetElementId, depth: 0 }]
	const visitedGraphElementIds = new Set<string>([targetElementId])
	const collectedBySourceElementId = new Map<string, CollectedSource>()
	let queueIndex = 0
	let encounterOrder = 0

	const collectCandidate = (
		item: ConnectedInputSourceElement,
		depth: number,
		origin: ConnectedSourceOrigin,
	): void => {
		const next: CollectedSource = { item, depth, origin, order: encounterOrder }
		encounterOrder += 1
		const current = collectedBySourceElementId.get(item.sourceElementId)
		if (!current || shouldReplaceCollectedSource(current, next)) {
			collectedBySourceElementId.set(item.sourceElementId, next)
		}
	}

	while (queueIndex < queue.length) {
		const current = queue[queueIndex]
		queueIndex += 1
		if (!current || current.depth >= normalizedMaxDepth) continue

		const upstreamConnections = canvas.connectionManager.getUpstreamConnections(
			current.elementId,
		)
		for (const connection of upstreamConnections) {
			const sourceElement = canvas.elementManager.getElementData(connection.sourceElementId)
			if (!sourceElement || visitedGraphElementIds.has(sourceElement.id)) continue

			const sourceDepth = current.depth + 1
			const rootConnectionId = current.rootConnectionId ?? connection.id
			const rootSourceElementId = current.rootSourceElementId ?? sourceElement.id
			visitedGraphElementIds.add(sourceElement.id)
			const sourceCandidateId =
				sourceDepth === 1
					? connection.id
					: createConnectedUpstreamSourceId(targetElementId, sourceElement.id)

			if (isConnectedSourceConsumableElement(sourceElement)) {
				collectCandidate(
					{
						connectionId: sourceCandidateId,
						sourceElementId: sourceElement.id,
						element: sourceElement,
						rootConnectionId,
						rootSourceElementId,
						origin: "connected-element",
						depth: sourceDepth,
					},
					sourceDepth,
					"connected-element",
				)
			} else if (isConnectedSourceContainer(sourceElement)) {
				for (const frameSource of collectConnectedFrameSourceElements(
					sourceCandidateId,
					sourceElement,
					{
						excludedElementIds: [targetElementId],
						rootConnectionId,
						rootSourceElementId,
						depth: sourceDepth,
					},
				)) {
					collectCandidate(frameSource, sourceDepth, "frame-descendant")
				}
			}

			if (sourceDepth < normalizedMaxDepth) {
				queue.push({
					elementId: sourceElement.id,
					depth: sourceDepth,
					rootConnectionId,
					rootSourceElementId,
				})
			}
		}
	}

	return Array.from(collectedBySourceElementId.values())
		.sort((left, right) => left.depth - right.depth || left.order - right.order)
		.map(({ item }) => item)
}

export function collectConnectedSourceElements(
	canvas: Canvas,
	targetElementId: string,
	config: ConnectedSourceCollectionConfig = DEFAULT_SOURCE_COLLECTION_CONFIG,
): ConnectedInputSourceElement[] {
	if (config.mode === "direct") {
		return collectDirectConnectedSourceElements(canvas, targetElementId)
	}
	return collectConnectedUpstreamSourceElements(canvas, targetElementId, config.maxDepth)
}

/** Collects the media inputs of a video-edit node from the connection graph. */
export function collectConnectedVideoEditInputs(
	canvas: Canvas,
	targetElementId: string,
): { videoElementIds: string[]; audioElementId?: string; audioElementIds: string[] } {
	if (!canvas.connectionManager?.getUpstreamConnections) {
		return { videoElementIds: [], audioElementIds: [] }
	}
	const sources = collectConnectedSourceElements(canvas, targetElementId, {
		mode: "direct",
		maxDepth: 1,
	})
	return {
		videoElementIds: sources
			.filter((source) => source.element.type === ElementTypeEnum.Video)
			.map((source) => source.sourceElementId),
		audioElementIds: sources
			.filter((source) => source.element.type === ElementTypeEnum.Audio)
			.map((source) => source.sourceElementId),
		audioElementId: sources.find((source) => source.element.type === ElementTypeEnum.Audio)
			?.sourceElementId,
	}
}

/** Collects VideoEdit inputs in the persisted user order, appending new connections. */
export function collectOrderedVideoEditInputs(
	canvas: Canvas,
	targetElementId: string,
): { videoElementIds: string[]; audioElementIds: string[] } {
	const connected = collectConnectedVideoEditInputs(canvas, targetElementId)
	const target = canvas.elementManager.getElementData(targetElementId)
	const content =
		target?.type === ElementTypeEnum.VideoEdit
			? getActiveContent<VideoEditElementContent>(target)
			: undefined
	const order = (preferred: string[] | undefined, available: string[]) => {
		const availableSet = new Set(available)
		const result: string[] = []
		;(preferred ?? []).forEach((elementId) => {
			if (availableSet.has(elementId) && !result.includes(elementId)) result.push(elementId)
		})
		available.forEach((elementId) => {
			if (!result.includes(elementId)) result.push(elementId)
		})
		return result
	}

	return {
		videoElementIds: order(content?.videoSequence, connected.videoElementIds),
		audioElementIds: order(content?.audioSequence, connected.audioElementIds),
	}
}
