import { ElementTypeEnum, type ElementType } from "../../document/types"
import { FRAME_CONTENT_PADDING_RATIO } from "../frame/frameCreation"

/** Supported automatic arrangement modes. */
export type ArrangementMode =
	"smart" | "layered" | "type-group" | "compact-grid" | "horizontal-row" | "vertical-column"

/** A small, serialisable node snapshot consumed by the pure layout engine. */
export interface ArrangementNode {
	id: string
	type: ElementType
	x: number
	y: number
	width: number
	height: number
	locked: boolean
	visible: boolean
	originalIndex: number
	zIndex: number
}

/** The persisted connection shape is intentionally accepted without importing Canvas. */
export interface ArrangementConnection {
	id?: string
	sourceElementId: string
	targetElementId: string
}

export interface ArrangementPoint {
	x: number
	y: number
}

export interface ArrangementResult {
	/** New positions for movable nodes. Locked nodes are omitted. */
	positions: Map<string, ArrangementPoint>
	changed: boolean
	arrangedNodeCount: number
	layerCount: number
	isolatedNodeCount: number
	cycleNodeCount: number
	skippedLockedCount: number
}

export interface ArrangementLayoutOptions {
	mode: ArrangementMode
	connections?: readonly ArrangementConnection[]
	/** Optional anchor. When omitted the current content bounds are used. */
	origin?: ArrangementPoint
	/** The selected Frame/Group's local size, used for centering and overflow expansion. */
	containerSize?: { width: number; height: number }
	/** Primarily useful for deterministic tests; normal callers use the fixed rule. */
	gap?: number
}

const TYPE_ORDER: readonly ElementType[] = [
	ElementTypeEnum.Image,
	ElementTypeEnum.Storyboard,
	ElementTypeEnum.Video,
	ElementTypeEnum.Audio,
	ElementTypeEnum.VideoEdit,
]

const TYPE_RANK = new Map<ElementType, number>(TYPE_ORDER.map((type, index) => [type, index]))

const MIN_GAP = 24
const MAX_GAP = 80
const GAP_RATIO = 0.2

interface Bounds {
	minX: number
	maxX: number
	minY: number
	maxY: number
}

interface Component {
	id: number
	nodes: ArrangementNode[]
	indegree: number
	outgoing: Set<number>
	layer: number
}

function finite(value: number | undefined, fallback = 0): number {
	return Number.isFinite(value) ? (value as number) : fallback
}

function widthOf(node: ArrangementNode): number {
	return Math.max(0, finite(node.width))
}

function heightOf(node: ArrangementNode): number {
	return Math.max(0, finite(node.height))
}

function compareStable(left: ArrangementNode, right: ArrangementNode): number {
	return (
		finite(left.y) - finite(right.y) ||
		finite(left.x) - finite(right.x) ||
		finite(left.zIndex) - finite(right.zIndex) ||
		left.id.localeCompare(right.id) ||
		left.originalIndex - right.originalIndex
	)
}

/**
 * Equal-sized nodes keep their source order so repeating an arrangement is
 * deterministic and does not unnecessarily reshuffle the user's content.
 */
function compareOriginalOrder(left: ArrangementNode, right: ArrangementNode): number {
	return (
		left.originalIndex - right.originalIndex ||
		finite(left.zIndex) - finite(right.zIndex) ||
		left.id.localeCompare(right.id)
	)
}

/**
 * A horizontal row reads as a left-to-right visual contour. Larger cards lead
 * with their height so the top and bottom edges taper predictably; source order
 * remains the tie-breaker for equal heights.
 */
function compareHorizontalOrder(left: ArrangementNode, right: ArrangementNode): number {
	return heightOf(right) - heightOf(left) || compareOriginalOrder(left, right)
}

/**
 * A vertical column uses the same visual rule on its perpendicular axis:
 * wider cards lead, while equal-width cards retain their source order.
 */
function compareVerticalOrder(left: ArrangementNode, right: ArrangementNode): number {
	return widthOf(right) - widthOf(left) || compareOriginalOrder(left, right)
}

function getBounds(nodes: readonly ArrangementNode[]): Bounds {
	if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
	return nodes.reduce<Bounds>(
		(bounds, node) => ({
			minX: Math.min(bounds.minX, finite(node.x)),
			maxX: Math.max(bounds.maxX, finite(node.x) + widthOf(node)),
			minY: Math.min(bounds.minY, finite(node.y)),
			maxY: Math.max(bounds.maxY, finite(node.y) + heightOf(node)),
		}),
		{ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
	)
}

function resolveGap(nodes: readonly ArrangementNode[], explicitGap?: number): number {
	if (explicitGap !== undefined && Number.isFinite(explicitGap)) {
		return Math.max(MIN_GAP, Math.min(MAX_GAP, explicitGap))
	}
	const maxNodeSize = nodes.reduce(
		(maximum, node) => Math.max(maximum, widthOf(node), heightOf(node)),
		0,
	)
	return Math.max(MIN_GAP, Math.min(MAX_GAP, maxNodeSize * GAP_RATIO))
}

function setPosition(
	positions: Map<string, ArrangementPoint>,
	node: ArrangementNode,
	x: number,
	y: number,
): void {
	positions.set(node.id, { x, y })
}

function layoutCompactGrid(
	nodes: readonly ArrangementNode[],
	origin: ArrangementPoint,
	gap: number,
): Map<string, ArrangementPoint> {
	const positions = new Map<string, ArrangementPoint>()
	const sorted = [...nodes].sort(compareStable)
	if (sorted.length === 0) return positions

	const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)))
	const rows = Math.ceil(sorted.length / columns)
	const columnWidths = Array.from({ length: columns }, (_, column) =>
		Math.max(...sorted.filter((_, index) => index % columns === column).map(widthOf), 0),
	)
	const rowHeights = Array.from({ length: rows }, (_, row) =>
		Math.max(...sorted.slice(row * columns, (row + 1) * columns).map(heightOf), 0),
	)
	const columnOffsets = columnWidths.reduce<number[]>((offsets, _width, index) => {
		offsets[index] = index === 0 ? 0 : offsets[index - 1] + columnWidths[index - 1] + gap
		return offsets
	}, [])
	const rowOffsets = rowHeights.reduce<number[]>((offsets, _height, index) => {
		offsets[index] = index === 0 ? 0 : offsets[index - 1] + rowHeights[index - 1] + gap
		return offsets
	}, [])

	sorted.forEach((node, index) => {
		const row = Math.floor(index / columns)
		const column = index % columns
		setPosition(positions, node, origin.x + columnOffsets[column], origin.y + rowOffsets[row])
	})
	return positions
}

function layoutTypeGroups(
	nodes: readonly ArrangementNode[],
	origin: ArrangementPoint,
	gap: number,
): Map<string, ArrangementPoint> {
	const positions = new Map<string, ArrangementPoint>()
	const groups = new Map<number, ArrangementNode[]>()
	for (const node of [...nodes].sort(compareStable)) {
		const rank = TYPE_RANK.get(node.type) ?? TYPE_ORDER.length
		const group = groups.get(rank) ?? []
		group.push(node)
		groups.set(rank, group)
	}

	// Keep type groups in the same visual column and stack them vertically.  This
	// mirrors the material-board mental model: the type order is read top-to-bottom,
	// while each group still uses the compact grid primitive for its own members.
	let groupY = origin.y
	for (const [, group] of [...groups.entries()].sort(([left], [right]) => left - right)) {
		const groupPositions = layoutCompactGrid(group, { x: origin.x, y: groupY }, gap)
		groupPositions.forEach((point, id) => positions.set(id, point))
		const groupBounds = getBounds(
			group.map((node) => ({
				...node,
				x: groupPositions.get(node.id)?.x ?? node.x,
				y: groupPositions.get(node.id)?.y ?? node.y,
			})),
		)
		groupY = groupBounds.maxY + gap
	}
	return positions
}

function layoutHorizontalRow(
	nodes: readonly ArrangementNode[],
	origin: ArrangementPoint,
	gap: number,
): Map<string, ArrangementPoint> {
	const positions = new Map<string, ArrangementPoint>()
	let x = origin.x
	const centerY = origin.y
	for (const node of [...nodes].sort(compareHorizontalOrder)) {
		setPosition(positions, node, x, centerY - heightOf(node) / 2)
		x += widthOf(node) + gap
	}
	return positions
}

function layoutVerticalColumn(
	nodes: readonly ArrangementNode[],
	origin: ArrangementPoint,
	gap: number,
): Map<string, ArrangementPoint> {
	const positions = new Map<string, ArrangementPoint>()
	let y = origin.y
	const centerX = origin.x
	for (const node of [...nodes].sort(compareVerticalOrder)) {
		setPosition(positions, node, centerX - widthOf(node) / 2, y)
		y += heightOf(node) + gap
	}
	return positions
}

function getLinearExtent(nodes: readonly ArrangementNode[], axis: "x" | "y", gap: number): number {
	const total = nodes.reduce(
		(sum, node) => sum + (axis === "x" ? widthOf(node) : heightOf(node)),
		0,
	)
	return total + Math.max(0, nodes.length - 1) * gap
}

function getContainerPadding(contentWidth: number, contentHeight: number): number {
	return Math.max(0, Math.min(contentWidth, contentHeight) * FRAME_CONTENT_PADDING_RATIO)
}

/** Tarjan's SCC algorithm keeps cyclic input usable instead of abandoning layout. */
function stronglyConnectedComponents(
	nodes: readonly ArrangementNode[],
	edges: readonly ArrangementConnection[],
): { components: Component[]; cycleNodeCount: number } {
	const byId = new Map(nodes.map((node) => [node.id, node]))
	const adjacency = new Map<string, Set<string>>()
	for (const node of nodes) adjacency.set(node.id, new Set())
	for (const edge of edges) {
		if (byId.has(edge.sourceElementId) && byId.has(edge.targetElementId)) {
			adjacency.get(edge.sourceElementId)?.add(edge.targetElementId)
		}
	}

	let index = 0
	const indexes = new Map<string, number>()
	const lowLinks = new Map<string, number>()
	const stack: string[] = []
	const onStack = new Set<string>()
	const groups: ArrangementNode[][] = []

	const visit = (id: string): void => {
		indexes.set(id, index)
		lowLinks.set(id, index)
		index += 1
		stack.push(id)
		onStack.add(id)

		for (const next of adjacency.get(id) ?? []) {
			if (!indexes.has(next)) {
				visit(next)
				lowLinks.set(id, Math.min(lowLinks.get(id) ?? 0, lowLinks.get(next) ?? 0))
			} else if (onStack.has(next)) {
				lowLinks.set(id, Math.min(lowLinks.get(id) ?? 0, indexes.get(next) ?? 0))
			}
		}

		if (lowLinks.get(id) !== indexes.get(id)) return
		const group: ArrangementNode[] = []
		let member: string | undefined
		do {
			member = stack.pop()
			if (!member) break
			onStack.delete(member)
			const node = byId.get(member)
			if (node) group.push(node)
		} while (member !== id)
		groups.push(group.sort(compareStable))
	}

	for (const node of nodes) {
		if (!indexes.has(node.id)) visit(node.id)
	}

	const componentByNodeId = new Map<string, number>()
	groups.forEach((group, componentId) => {
		group.forEach((node) => componentByNodeId.set(node.id, componentId))
	})
	const components: Component[] = groups.map((group, id) => ({
		id,
		nodes: group,
		indegree: 0,
		outgoing: new Set(),
		layer: 0,
	}))
	for (const edge of edges) {
		const source = componentByNodeId.get(edge.sourceElementId)
		const target = componentByNodeId.get(edge.targetElementId)
		if (source === undefined || target === undefined || source === target) continue
		const outgoing = components[source].outgoing
		if (outgoing.has(target)) continue
		outgoing.add(target)
		components[target].indegree += 1
	}

	const cycleNodeCount = components.reduce((count, component) => {
		if (component.nodes.length > 1) return count + component.nodes.length
		const [node] = component.nodes
		const selfLoop = node ? (adjacency.get(node.id)?.has(node.id) ?? false) : false
		return selfLoop ? count + 1 : count
	}, 0)
	return { components, cycleNodeCount }
}

function layoutLayered(
	nodes: readonly ArrangementNode[],
	connections: readonly ArrangementConnection[],
	origin: ArrangementPoint,
	gap: number,
): {
	positions: Map<string, ArrangementPoint>
	layerCount: number
	isolatedNodeCount: number
	cycleNodeCount: number
} {
	const positions = new Map<string, ArrangementPoint>()
	if (nodes.length === 0) {
		return { positions, layerCount: 0, isolatedNodeCount: 0, cycleNodeCount: 0 }
	}

	const nodeIds = new Set(nodes.map((node) => node.id))
	// Locked nodes are deliberately omitted from the layout graph.  Filter edges
	// before deriving connected components as well; otherwise an edge that ends at
	// a locked node would make its movable peer look connected while Tarjan later
	// silently drops that endpoint.
	const internalEdges = connections.filter(
		(edge) => nodeIds.has(edge.sourceElementId) && nodeIds.has(edge.targetElementId),
	)
	const connectedIds = new Set<string>()
	for (const edge of internalEdges) {
		connectedIds.add(edge.sourceElementId)
		connectedIds.add(edge.targetElementId)
	}
	const connectedNodes = nodes.filter((node) => connectedIds.has(node.id))
	const isolatedNodes = nodes.filter((node) => !connectedIds.has(node.id))
	if (connectedNodes.length === 0) {
		const isolatedPositions = layoutTypeGroups(nodes, origin, gap)
		isolatedPositions.forEach((point, id) => positions.set(id, point))
		return {
			positions,
			layerCount: 0,
			isolatedNodeCount: nodes.length,
			cycleNodeCount: 0,
		}
	}

	const { components, cycleNodeCount } = stronglyConnectedComponents(
		connectedNodes,
		internalEdges,
	)
	const queue = components.filter((component) => component.indegree === 0).sort(compareComponents)
	const pendingIndegrees = new Map(
		components.map((component) => [component.id, component.indegree]),
	)
	while (queue.length > 0) {
		const component = queue.shift()
		if (!component) break
		for (const targetId of component.outgoing) {
			const target = components[targetId]
			if (!target) continue
			target.layer = Math.max(target.layer, component.layer + 1)
			const nextDegree = (pendingIndegrees.get(targetId) ?? 0) - 1
			pendingIndegrees.set(targetId, nextDegree)
			if (nextDegree === 0) queue.push(target)
		}
		queue.sort(compareComponents)
	}

	const layers = new Map<number, Component[]>()
	for (const component of components) {
		const layer = layers.get(component.layer) ?? []
		layer.push(component)
		layers.set(component.layer, layer)
	}
	// Tarjan assigns component ids according to DFS completion order. Sort each
	// layer explicitly so disconnected components remain stable by their canvas
	// position rather than by an implementation detail of the SCC traversal.
	const orderedLayers = [...layers.entries()]
		.map(
			([layer, componentsInLayer]) =>
				[layer, componentsInLayer.sort(compareComponents)] as const,
		)
		.sort(([left], [right]) => left - right)
	const layerWidths = orderedLayers.map(([, layer]) =>
		Math.max(...layer.map((component) => Math.max(...component.nodes.map(widthOf))), 0),
	)

	const layerNodes = orderedLayers.map(([, layer]) =>
		layer.flatMap((component) => component.nodes),
	)
	const layerByNodeId = new Map<string, number>()
	layerNodes.forEach((layer, layerIndex) => {
		layer.forEach((node) => layerByNodeId.set(node.id, layerIndex))
	})
	const incoming = new Map<string, ArrangementNode[]>()
	const outgoing = new Map<string, ArrangementNode[]>()
	const nodeById = new Map(nodes.map((node) => [node.id, node]))
	for (const edge of internalEdges) {
		const source = nodeById.get(edge.sourceElementId)
		const target = nodeById.get(edge.targetElementId)
		if (!source || !target) continue
		// Edges inside an SCC do not provide a stable vertical target. Ignoring
		// same-layer edges keeps cyclic components stable while still allowing
		// edges between adjacent layers to pull their endpoints into alignment.
		if (layerByNodeId.get(source.id) === layerByNodeId.get(target.id)) continue
		const targetIncoming = incoming.get(target.id) ?? []
		targetIncoming.push(source)
		incoming.set(target.id, targetIncoming)
		const sourceOutgoing = outgoing.get(source.id) ?? []
		sourceOutgoing.push(target)
		outgoing.set(source.id, sourceOutgoing)
	}

	let layerX = origin.x
	for (let layerIndex = 0; layerIndex < orderedLayers.length; layerIndex += 1) {
		const layer = layerNodes[layerIndex] ?? []
		let componentY = origin.y
		const layerWidth = layerWidths[layerIndex] ?? 0
		for (const node of layer) {
			// A layer is a visual column: centering narrower cards in the
			// column keeps same-layer nodes aligned even when their widths differ.
			setPosition(positions, node, layerX + (layerWidth - widthOf(node)) / 2, componentY)
			componentY += heightOf(node) + gap
		}
		layerX += layerWidths[layerIndex] + gap
	}

	/**
	 * Pull each layer towards the centres of its neighbouring layers. A simple
	 * layer stack is deterministic, but fan-in/fan-out graphs look noticeably
	 * better when their endpoints share the same vertical rhythm. The complete
	 * layer is translated as one unit, preserving the configured gap and the
	 * stable order established above.
	 */
	const alignLayer = (
		layer: ArrangementNode[],
		neighbourMap: Map<string, ArrangementNode[]>,
	): void => {
		let desiredTotal = 0
		let currentTotal = 0
		let measuredNodes = 0
		for (const node of layer) {
			const neighbours = neighbourMap.get(node.id) ?? []
			const centres = neighbours
				.map((neighbour) => {
					const point = positions.get(neighbour.id)
					return point ? point.y + heightOf(neighbour) / 2 : null
				})
				.filter((center): center is number => center !== null)
			const current = positions.get(node.id)
			const currentCenter = current ? current.y + heightOf(node) / 2 : origin.y
			const desiredCenter =
				centres.length > 0
					? centres.reduce((sum, center) => sum + center, 0) / centres.length
					: currentCenter
			desiredTotal += desiredCenter
			currentTotal += currentCenter
			measuredNodes += 1
		}
		if (measuredNodes === 0) return
		const offset = (desiredTotal - currentTotal) / measuredNodes
		if (Math.abs(offset) < 0.001) return
		for (const node of layer) {
			const current = positions.get(node.id)
			if (current) positions.set(node.id, { x: current.x, y: current.y + offset })
		}
	}

	for (let pass = 0; pass < 2; pass += 1) {
		for (let layerIndex = 1; layerIndex < layerNodes.length; layerIndex += 1) {
			alignLayer(layerNodes[layerIndex], incoming)
		}
		for (let layerIndex = layerNodes.length - 2; layerIndex >= 0; layerIndex -= 1) {
			alignLayer(layerNodes[layerIndex], outgoing)
		}
	}

	// The centre correction can move the first node above the requested origin.
	// Translate the complete graph back into the original local-coordinate area
	// without changing the relative vertical rhythm just established.
	const minimumY = Math.min(...nodes.map((node) => positions.get(node.id)?.y ?? origin.y))
	if (Number.isFinite(minimumY) && minimumY !== origin.y) {
		const offset = origin.y - minimumY
		positions.forEach((point, id) => positions.set(id, { x: point.x, y: point.y + offset }))
	}

	if (isolatedNodes.length > 0) {
		const isolatedOrigin = { x: layerX, y: origin.y }
		const isolatedPositions = layoutTypeGroups(isolatedNodes, isolatedOrigin, gap)
		isolatedPositions.forEach((point, id) => positions.set(id, point))
	}

	return {
		positions,
		layerCount: orderedLayers.length,
		isolatedNodeCount: isolatedNodes.length,
		cycleNodeCount,
	}
}

function compareComponents(left: Component, right: Component): number {
	const leftNode = left.nodes[0]
	const rightNode = right.nodes[0]
	return leftNode && rightNode ? compareStable(leftNode, rightNode) : left.id - right.id
}

function resolveOrigin(
	nodes: readonly ArrangementNode[],
	explicitOrigin?: ArrangementPoint,
): ArrangementPoint {
	if (explicitOrigin) return { x: finite(explicitOrigin.x), y: finite(explicitOrigin.y) }
	const bounds = getBounds(nodes)
	return { x: bounds.minX, y: bounds.minY }
}

/**
 * Pure layout entry point. It never mutates input nodes or connection data, which keeps
 * preview/testing deterministic and lets AlignmentManager submit one atomic patch later.
 */
export function arrangeNodes(
	nodes: readonly ArrangementNode[],
	options: ArrangementLayoutOptions,
): ArrangementResult {
	const movableNodes = nodes.filter((node) => !node.locked)
	const skippedLockedCount = nodes.length - movableNodes.length
	const positions = new Map<string, ArrangementPoint>()
	for (const node of movableNodes)
		positions.set(node.id, { x: finite(node.x), y: finite(node.y) })

	if (movableNodes.length < 2) {
		return {
			positions,
			changed: false,
			arrangedNodeCount: 0,
			layerCount: 0,
			isolatedNodeCount: 0,
			cycleNodeCount: 0,
			skippedLockedCount,
		}
	}

	// Locked nodes are boundary anchors, not layout participants. Deriving the
	// layout origin from movable nodes keeps a distant locked item from shifting
	// every movable item into an unexpected overlap.
	const origin = resolveOrigin(movableNodes, options.origin)
	const currentBounds = getBounds(movableNodes)
	const gap = resolveGap(movableNodes, options.gap)
	const containerWidth = finite(options.containerSize?.width)
	const containerHeight = finite(options.containerSize?.height)
	const hasContainer = options.containerSize !== undefined
	const connections = options.connections ?? []
	let layoutStats = { layerCount: 0, isolatedNodeCount: 0, cycleNodeCount: 0 }
	let nextPositions: Map<string, ArrangementPoint>

	let mode = options.mode
	if (mode === "smart") {
		const ids = new Set(movableNodes.map((node) => node.id))
		const hasInternalConnection = connections.some(
			(edge) => ids.has(edge.sourceElementId) && ids.has(edge.targetElementId),
		)
		if (hasInternalConnection) {
			mode = "layered"
		} else {
			mode = "type-group"
		}
	}

	switch (mode) {
		case "layered": {
			const result = layoutLayered(movableNodes, connections, origin, gap)
			nextPositions = result.positions
			layoutStats = {
				layerCount: result.layerCount,
				isolatedNodeCount: result.isolatedNodeCount,
				cycleNodeCount: result.cycleNodeCount,
			}
			break
		}
		case "type-group":
			nextPositions = layoutTypeGroups(movableNodes, origin, gap)
			break
		case "horizontal-row":
			{
				const rowWidth = getLinearExtent(movableNodes, "x", gap)
				const rowHeight = Math.max(...movableNodes.map(heightOf), 0)
				const padding = getContainerPadding(rowWidth, rowHeight)
				const layoutWidth = hasContainer
					? Math.max(containerWidth, rowWidth + padding * 2)
					: containerWidth
				const layoutHeight = hasContainer
					? Math.max(containerHeight, rowHeight + padding * 2)
					: containerHeight
				nextPositions = layoutHorizontalRow(
					movableNodes,
					{
						x: hasContainer ? (layoutWidth - rowWidth) / 2 : origin.x,
						y: hasContainer
							? layoutHeight / 2
							: (currentBounds.minY + currentBounds.maxY) / 2,
					},
					gap,
				)
			}
			break
		case "vertical-column":
			{
				const columnHeight = getLinearExtent(movableNodes, "y", gap)
				const columnWidth = Math.max(...movableNodes.map(widthOf), 0)
				const padding = getContainerPadding(columnWidth, columnHeight)
				const layoutWidth = hasContainer
					? Math.max(containerWidth, columnWidth + padding * 2)
					: containerWidth
				const layoutHeight = hasContainer
					? Math.max(containerHeight, columnHeight + padding * 2)
					: containerHeight
				nextPositions = layoutVerticalColumn(
					movableNodes,
					{
						x: hasContainer
							? layoutWidth / 2
							: (currentBounds.minX + currentBounds.maxX) / 2,
						y: hasContainer ? (layoutHeight - columnHeight) / 2 : origin.y,
					},
					gap,
				)
			}
			break
		case "compact-grid":
			nextPositions = layoutCompactGrid(movableNodes, origin, gap)
			break
		default:
			nextPositions = new Map(positions)
			break
	}

	let changed = false
	// The summary reports how many movable nodes were processed, while `changed`
	// independently tells callers whether any coordinate actually changed.
	const arrangedNodeCount = movableNodes.length
	for (const node of movableNodes) {
		const next = nextPositions.get(node.id) ?? { x: finite(node.x), y: finite(node.y) }
		const currentX = finite(node.x)
		const currentY = finite(node.y)
		if (Math.abs(next.x - currentX) > 0.001 || Math.abs(next.y - currentY) > 0.001) {
			changed = true
		}
		positions.set(node.id, next)
	}

	return {
		positions,
		changed,
		arrangedNodeCount,
		...layoutStats,
		skippedLockedCount,
	}
}

/** Friendly aliases for callers that describe the operation as a layout calculation. */
export const calculateArrangement = arrangeNodes
export const layoutArrangement = arrangeNodes

export function getArrangementGap(nodes: readonly ArrangementNode[]): number {
	return resolveGap(nodes.filter((node) => !node.locked))
}

export const ARRANGEMENT_TYPE_ORDER = TYPE_ORDER
