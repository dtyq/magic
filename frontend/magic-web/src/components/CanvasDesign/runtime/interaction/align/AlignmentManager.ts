import { toast } from "sonner"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type ElementUpdatePatch, type LayerElement } from "../../document/types"
import type { TOptions } from "../../../public/i18n-types"
import {
	arrangeNodes,
	type ArrangementMode,
	type ArrangementNode,
	type ArrangementPoint,
	type ArrangementResult,
} from "./arrangementLayout"
import { resolveFrameChildrenBounds } from "../frame/frameCreation"

/** 对齐类型。 */
export type AlignType =
	"left" | "horizontal-center" | "right" | "top" | "vertical-center" | "bottom"

/** 保留旧分布动作，同时把六种自动排列模式纳入同一入口。 */
export type DistributeType =
	"horizontal-spacing" | "vertical-spacing" | "auto-layout" | ArrangementMode

interface AlignmentScope {
	parent: LayerElement | null
	parentId: string | null
	allChildren: LayerElement[]
	targetNodes: LayerElement[]
	movableNodes: LayerElement[]
	isContainerSelection: boolean
}

interface RectBounds {
	minX: number
	maxX: number
	minY: number
	maxY: number
	centerX: number
	centerY: number
}

function isContainer(element: LayerElement | undefined): boolean {
	return element?.type === ElementTypeEnum.Frame || element?.type === ElementTypeEnum.Group
}

function getChildren(element: LayerElement | null | undefined): LayerElement[] {
	if (!element || !("children" in element) || !Array.isArray(element.children)) return []
	return element.children
}

function numberOrZero(value: number | undefined): number {
	return Number.isFinite(value) ? (value as number) : 0
}

function scaleOrOne(value: number | undefined): number {
	return Number.isFinite(value) ? (value as number) : 1
}

function compareByPosition(left: LayerElement, right: LayerElement, axis: "x" | "y"): number {
	return (
		numberOrZero(left[axis]) - numberOrZero(right[axis]) ||
		numberOrZero(left[axis === "x" ? "y" : "x"]) -
			numberOrZero(right[axis === "x" ? "y" : "x"]) ||
		numberOrZero(left.zIndex) - numberOrZero(right.zIndex) ||
		left.id.localeCompare(right.id)
	)
}

function hasGeometryDifference(left: LayerElement, right: LayerElement): boolean {
	return (
		left.id !== right.id ||
		numberOrZero(left.x) !== numberOrZero(right.x) ||
		numberOrZero(left.y) !== numberOrZero(right.y) ||
		numberOrZero(left.width) !== numberOrZero(right.width) ||
		numberOrZero(left.height) !== numberOrZero(right.height) ||
		scaleOrOne(left.scaleX) !== scaleOrOne(right.scaleX) ||
		scaleOrOne(left.scaleY) !== scaleOrOne(right.scaleY)
	)
}

/**
 * Alignment/distribution operations are intentionally resolved as one scope first.
 * This prevents a mixed Frame + child selection from partially mutating the document.
 */
export class AlignmentManager {
	private canvas: Canvas

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	/** Whether the current selection is a legal alignment/layout scope. */
	public canExecuteCurrentSelection(): boolean {
		if (!this.canWrite()) return false
		const scope = this.resolveScope(false)
		return Boolean(scope && scope.movableNodes.length > 0)
	}

	/** Whether one of the six automatic arrangements has enough movable nodes. */
	public canExecuteArrangement(): boolean {
		if (!this.canWrite()) return false
		const scope = this.resolveScope(false)
		return Boolean(scope && scope.movableNodes.length >= 2)
	}

	/**
	 * Spacing distribution keeps its historical minimum: three ordinary nodes,
	 * while a selected container can distribute one or more direct children against
	 * its own edges. Keeping this check next to scope resolution prevents the menu
	 * from advertising an operation that would immediately no-op.
	 */
	public canExecuteSpacing(): boolean {
		if (!this.canWrite()) return false
		const scope = this.resolveScope(false)
		if (!scope) return false
		return scope.movableNodes.length >= (scope.isContainerSelection ? 1 : 3)
	}

	/** Execute one of the six automatic arrangement modes. */
	public arrange(mode: ArrangementMode = "smart"): ArrangementResult | null {
		if (!this.canWrite()) return null
		const scope = this.resolveScope(true)
		if (!scope) return null

		// The product contract deliberately treats a one-node layout as a no-op. In
		// particular, do not resize a Frame/Group in this case.
		if (scope.movableNodes.length < 2) {
			this.notifyWarning(
				"elementTools.elementDistribute.insufficientNodes",
				"至少需要两个可移动节点",
			)
			return null
		}

		const arrangementInput = scope.isContainerSelection ? scope.allChildren : scope.targetNodes
		const documentOrder = scope.parent
			? scope.allChildren
			: (this.canvas.elementManager.getAllElements?.() ?? scope.targetNodes)
		const orderById = new Map(documentOrder.map((element, index) => [element.id, index]))
		const arrangementNodes = arrangementInput.map((element, fallbackIndex) =>
			this.toArrangementNode(element, orderById.get(element.id) ?? fallbackIndex),
		)
		const scopeIds = new Set(scope.targetNodes.map((node) => node.id))
		const connections = (this.canvas.connectionManager?.getConnections?.() ?? []).filter(
			(connection) =>
				scopeIds.has(connection.sourceElementId) &&
				scopeIds.has(connection.targetElementId),
		)
		const result = arrangeNodes(arrangementNodes, {
			mode,
			connections,
			containerSize: scope.parent
				? {
						width: numberOrZero(scope.parent.width),
						height: numberOrZero(scope.parent.height),
					}
				: undefined,
		})

		const positions = new Map<string, ArrangementPoint>()
		for (const node of scope.targetNodes) {
			const position = result.positions.get(node.id)
			if (position) positions.set(node.id, position)
		}
		const committed = this.commitGeometry(scope, positions, true)
		if (committed) {
			this.notifyArrangementResult(result)
		} else if (!result.changed) {
			this.notifyArrangementUnchanged()
		}
		return result
	}

	/** Backwards-compatible name used by older callers and Shift+A. */
	public autoLayout(): ArrangementResult | null {
		return this.arrange("smart")
	}

	/** Execute alignment against the current legal scope. */
	public align(alignType: AlignType): boolean {
		if (!this.canWrite()) return false
		const scope = this.resolveScope(true)
		if (!scope) return false
		if (scope.movableNodes.length === 0) {
			this.notifyWarning("elementTools.elementDistribute.noMovableNodes", "没有可移动节点")
			return false
		}

		const bounds = this.calculateBounds(scope.targetNodes)
		const positions = new Map<string, ArrangementPoint>()
		for (const element of scope.movableNodes) {
			const width = numberOrZero(element.width)
			const height = numberOrZero(element.height)
			let x = numberOrZero(element.x)
			let y = numberOrZero(element.y)
			switch (alignType) {
				case "left":
					x = bounds.minX
					break
				case "horizontal-center":
					x = bounds.centerX - width / 2
					break
				case "right":
					x = bounds.maxX - width
					break
				case "top":
					y = bounds.minY
					break
				case "vertical-center":
					y = bounds.centerY - height / 2
					break
				case "bottom":
					y = bounds.maxY - height
					break
			}
			positions.set(element.id, { x, y })
		}

		const committed = this.commitGeometry(scope, positions, true)
		if (committed) {
			this.notifyGeometryResult(
				"alignment",
				scope.movableNodes.length,
				scope.targetNodes.length - scope.movableNodes.length,
			)
		}
		return committed
	}

	/** Execute legacy spacing or one of the named arrangement modes. */
	public distribute(distributeType: DistributeType): ArrangementResult | null {
		if (!this.canWrite()) return null
		if (
			distributeType === "smart" ||
			distributeType === "layered" ||
			distributeType === "type-group" ||
			distributeType === "compact-grid" ||
			distributeType === "horizontal-row" ||
			distributeType === "vertical-column" ||
			distributeType === "auto-layout"
		) {
			return this.arrange(distributeType === "auto-layout" ? "smart" : distributeType)
		}

		const scope = this.resolveScope(true)
		if (!scope) return null
		const movable = scope.movableNodes
		const minimum = scope.isContainerSelection ? 1 : 3
		if (movable.length < minimum) {
			this.notifyWarning(
				minimum === 1
					? "elementTools.elementDistribute.noMovableNodes"
					: "elementTools.elementDistribute.insufficientSpacingNodes",
				minimum === 1 ? "没有可移动节点" : "至少需要三个可移动节点",
			)
			return null
		}

		const positions =
			distributeType === "horizontal-spacing"
				? this.calculateHorizontalSpacing(scope)
				: this.calculateVerticalSpacing(scope)
		const committed = this.commitGeometry(scope, positions, true)
		if (committed) {
			this.notifyGeometryResult(
				"spacing",
				scope.movableNodes.length,
				scope.targetNodes.length - scope.movableNodes.length,
			)
		}
		return {
			positions,
			changed: movable.some((element) => {
				const next = positions.get(element.id)
				return Boolean(
					next &&
					(Math.abs(numberOrZero(element.x) - next.x) > 0.001 ||
						Math.abs(numberOrZero(element.y) - next.y) > 0.001),
				)
			}),
			arrangedNodeCount: movable.length,
			layerCount: 0,
			isolatedNodeCount: 0,
			cycleNodeCount: 0,
			skippedLockedCount: scope.targetNodes.length - movable.length,
		}
	}

	private resolveScope(showWarning: boolean): AlignmentScope | null {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return null

		const selected = selectedIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((element): element is LayerElement => Boolean(element))
		if (selected.length !== selectedIds.length) return null

		let parent: LayerElement | null = null
		let parentId: string | null = null
		let allChildren: LayerElement[]
		let targetNodes: LayerElement[]
		let isContainerSelection = false

		if (selected.length === 1 && isContainer(selected[0])) {
			const container = selected[0]
			if (container.locked) {
				if (showWarning)
					this.notifyWarning(
						"elementTools.elementDistribute.locked",
						"当前父级或容器已锁定",
					)
				return null
			}
			parent = container
			parentId = container.id
			allChildren = this.resolveLatestChildren(container)
			targetNodes = allChildren
			isContainerSelection = true
		} else {
			// Ordinary multi-select only; selecting a Frame/Group together with peers is
			// intentionally rejected because its children would otherwise be ambiguous.
			if (selected.length < 2 || selected.some((element) => isContainer(element))) {
				if (showWarning)
					this.notifyWarning(
						"elementTools.elementDistribute.invalidSelection",
						"请选择同一父级下的普通节点",
					)
				return null
			}
			const selectedParentIds = selected.map((element) => this.findParentId(element.id))
			const firstParentId = selectedParentIds[0]
			if (selectedParentIds.some((candidate) => candidate !== firstParentId)) {
				if (showWarning)
					this.notifyWarning(
						"elementTools.elementDistribute.invalidSelection",
						"请选择同一父级下的普通节点",
					)
				return null
			}
			parentId = firstParentId
			parent = parentId ? (this.canvas.elementManager.getElementData(parentId) ?? null) : null
			if (parentId && !parent) {
				if (showWarning)
					this.notifyWarning(
						"elementTools.elementDistribute.invalidSelection",
						"请选择同一父级下的普通节点",
					)
				return null
			}
			if (parentId && parent && !isContainer(parent)) {
				if (showWarning)
					this.notifyWarning(
						"elementTools.elementDistribute.invalidSelection",
						"请选择同一父级下的普通节点",
					)
				return null
			}
			if (parent?.locked) {
				if (showWarning)
					this.notifyWarning("elementTools.elementDistribute.locked", "父级已锁定")
				return null
			}
			allChildren = parent ? this.resolveLatestChildren(parent) : selected
			targetNodes = selected
		}

		const movableNodes = targetNodes.filter((element) => !element.locked)
		return { parent, parentId, allChildren, targetNodes, movableNodes, isContainerSelection }
	}

	private canWrite(): boolean {
		return typeof this.canvas.permissionManager?.can === "function"
			? this.canvas.permissionManager.can("document.write")
			: true
	}

	private resolveLatestChildren(parent: LayerElement): LayerElement[] {
		return getChildren(parent).flatMap((child) => {
			const latest = this.canvas.elementManager.getElementData(child.id)
			return [latest ?? child]
		})
	}

	private findParentId(elementId: string): string | null {
		const resolver = this.canvas.elementManager.findParentIdForElement
		return typeof resolver === "function"
			? (resolver.call(this.canvas.elementManager, elementId) ?? null)
			: null
	}

	private toArrangementNode(element: LayerElement, originalIndex: number): ArrangementNode {
		return {
			id: element.id,
			type: element.type,
			x: numberOrZero(element.x),
			y: numberOrZero(element.y),
			width: numberOrZero(element.width),
			height: numberOrZero(element.height),
			locked: element.locked === true,
			visible: element.visible !== false,
			originalIndex,
			zIndex: numberOrZero(element.zIndex),
		}
	}

	private calculateHorizontalSpacing(scope: AlignmentScope): Map<string, ArrangementPoint> {
		const sorted = [...scope.movableNodes].sort((left, right) =>
			compareByPosition(left, right, "x"),
		)
		const positions = new Map<string, ArrangementPoint>()
		if (sorted.length === 0) return positions
		const first = sorted[0]
		const last = sorted[sorted.length - 1]
		const start = scope.isContainerSelection ? 0 : numberOrZero(first.x)
		const end = scope.isContainerSelection
			? this.resolveContainerExtent(scope, "x")
			: numberOrZero(last.x) + numberOrZero(last.width)
		const totalWidth = sorted.reduce((sum, element) => sum + numberOrZero(element.width), 0)
		const divisor = scope.isContainerSelection ? sorted.length + 1 : sorted.length - 1
		// A legacy Frame can be smaller than the sum of its children, and a Group may
		// not have a persisted width at all.  Never create a negative gap in either
		// case: the subsequent bounds pass will grow the container to fit the result.
		const spacing = Math.max(0, (end - start - totalWidth) / divisor)
		let current = scope.isContainerSelection ? start + spacing : start
		for (const element of sorted) {
			positions.set(element.id, { x: current, y: numberOrZero(element.y) })
			current += numberOrZero(element.width) + spacing
		}
		return positions
	}

	private calculateVerticalSpacing(scope: AlignmentScope): Map<string, ArrangementPoint> {
		const sorted = [...scope.movableNodes].sort((left, right) =>
			compareByPosition(left, right, "y"),
		)
		const positions = new Map<string, ArrangementPoint>()
		if (sorted.length === 0) return positions
		const first = sorted[0]
		const last = sorted[sorted.length - 1]
		const start = scope.isContainerSelection ? 0 : numberOrZero(first.y)
		const end = scope.isContainerSelection
			? this.resolveContainerExtent(scope, "y")
			: numberOrZero(last.y) + numberOrZero(last.height)
		const totalHeight = sorted.reduce((sum, element) => sum + numberOrZero(element.height), 0)
		const divisor = scope.isContainerSelection ? sorted.length + 1 : sorted.length - 1
		const spacing = Math.max(0, (end - start - totalHeight) / divisor)
		let current = scope.isContainerSelection ? start + spacing : start
		for (const element of sorted) {
			positions.set(element.id, { x: numberOrZero(element.x), y: current })
			current += numberOrZero(element.height) + spacing
		}
		return positions
	}

	private resolveContainerExtent(scope: AlignmentScope, axis: "x" | "y"): number {
		const persistedExtent = numberOrZero(scope.parent?.[axis === "x" ? "width" : "height"])
		const childrenBounds = resolveFrameChildrenBounds(scope.allChildren)
		// Children use the container's local coordinate system.  When a legacy
		// container has no persisted size, using only `max - min` would discard a
		// positive left/top offset and could place spacing items beyond the inferred
		// right/bottom edge.  Resolve the extent from the fixed origin instead.
		const contentExtent = childrenBounds
			? (axis === "x" ? childrenBounds.maxX : childrenBounds.maxY) + childrenBounds.padding
			: 0
		return Math.max(0, persistedExtent, contentExtent)
	}

	private commitGeometry(
		scope: AlignmentScope,
		positions: Map<string, ArrangementPoint>,
		resizeContainer: boolean,
	): boolean {
		const patches = new Map<string, ElementUpdatePatch>()
		// Keep the tolerance decision in one place.  The same effective positions
		// must feed both the individual element patches and the parent's nested
		// children snapshot; otherwise a sub-pixel layout result could be written to
		// the parent snapshot without being written to the live child element.
		const committedPositions = new Map<string, ArrangementPoint>()
		for (const element of scope.movableNodes) {
			const next = positions.get(element.id)
			if (!next) continue
			const xChanged = Math.abs(numberOrZero(element.x) - next.x) > 0.001
			const yChanged = Math.abs(numberOrZero(element.y) - next.y) > 0.001
			if (xChanged || yChanged) {
				committedPositions.set(element.id, next)
				// Include both coordinates whenever either axis changes. ElementManager
				// synchronises an omitted axis from the live Konva node; writing the pair
				// keeps the nested parent snapshot and the runtime node atomic even when a
				// layout command follows a just-finished transform.
				patches.set(element.id, { x: next.x, y: next.y })
			}
		}

		if (resizeContainer && scope.parent && scope.allChildren.length > 0) {
			const stagedChildren = scope.allChildren.map((child) => {
				const position = committedPositions.get(child.id)
				return position ? { ...child, x: position.x, y: position.y } : child
			})
			const parentChildren = getChildren(scope.parent)
			const childrenChanged =
				parentChildren.length !== stagedChildren.length ||
				parentChildren.some((child, index) => {
					const stagedChild = stagedChildren[index]
					return !stagedChild || hasGeometryDifference(child, stagedChild)
				})
			const parentPatch = patches.get(scope.parent.id) ?? {}
			const bounds = resolveFrameChildrenBounds(stagedChildren, {
				existingWidth: scope.parent.width,
				existingHeight: scope.parent.height,
			})
			if (bounds) {
				if (Math.abs(numberOrZero(scope.parent.width) - bounds.width) > 0.001) {
					parentPatch.width = bounds.width
				}
				if (Math.abs(numberOrZero(scope.parent.height) - bounds.height) > 0.001) {
					parentPatch.height = bounds.height
				}
			}
			// Container children are stored as nested snapshots as well as individual
			// runtime elements. Keep that snapshot in the same atomic update so a full
			// export or history capture cannot resurrect the old child coordinates.
			if (
				childrenChanged ||
				parentPatch.width !== undefined ||
				parentPatch.height !== undefined
			) {
				parentPatch.children = stagedChildren
			}
			if (Object.keys(parentPatch).length > 0) {
				// Explicitly carry the existing origin so ElementManager does not pull a
				// transient Konva drag position into this geometry-only transaction.
				if (scope.parent.x !== undefined) parentPatch.x = scope.parent.x
				if (scope.parent.y !== undefined) parentPatch.y = scope.parent.y
			}
			if (Object.keys(parentPatch).length > 0) patches.set(scope.parent.id, parentPatch)
		}

		if (patches.size === 0) return false
		const updates = [...patches.entries()].map(([id, data]) => ({ id, data }))
		const apply = () => {
			this.canvas.elementManager.batchUpdate(updates, { skipZIndexReorder: true })
		}
		const history = this.canvas.historyManager
		if (history && typeof history.runTransaction === "function") {
			history.runTransaction(apply)
		} else {
			// Older embedders may provide a minimal history facade; preserve atomicity there too.
			history?.disable?.()
			try {
				apply()
			} finally {
				history?.enable?.()
				history?.recordHistoryImmediate?.()
			}
		}
		this.refreshGeometryConsumers([...patches.keys()])
		return true
	}

	/**
	 * `batchUpdate` deliberately coalesces element events, so the normal per-element
	 * selection listeners cannot refresh their cached Transformer/highlight geometry.
	 * Refresh those view-only consumers after the atomic document commit.
	 */
	private refreshGeometryConsumers(geometryIds: readonly string[]): void {
		const selectionManager = this.canvas.selectionManager
		const selectedIds = selectionManager?.getSelectedIds?.() ?? []
		this.canvas.nameLabelManager?.refreshLabelLayouts?.(geometryIds)
		this.canvas.sizeLabelManager?.refreshLabelLayouts?.(geometryIds)
		if (selectedIds.length === 0) return

		selectionManager.refreshSelectionPosition?.()
		this.canvas.transformManager?.updateTransformer?.(selectedIds)
		this.canvas.selectionHighlightManager?.refreshHighlights?.(selectedIds)

		if (selectedIds.length > 1) {
			this.canvas.selectionHighlightManager?.updateHighlights?.(selectedIds)
			return
		}

		const selectedElement = this.canvas.elementManager.getElementData(selectedIds[0])
		const canTransform = this.canvas.permissionManager?.canTransform
		const isTransformable =
			typeof canTransform === "function"
				? canTransform.call(this.canvas.permissionManager, selectedElement)
				: selectedElement?.locked !== true
		if (isTransformable) {
			this.canvas.selectionHighlightManager?.clearAllHighlights?.()
		} else {
			this.canvas.selectionHighlightManager?.updateHighlights?.(selectedIds)
		}
	}

	private calculateBounds(elements: readonly LayerElement[]): RectBounds {
		const bounds = elements.reduce(
			(result, element) => ({
				minX: Math.min(result.minX, numberOrZero(element.x)),
				maxX: Math.max(result.maxX, numberOrZero(element.x) + numberOrZero(element.width)),
				minY: Math.min(result.minY, numberOrZero(element.y)),
				maxY: Math.max(result.maxY, numberOrZero(element.y) + numberOrZero(element.height)),
			}),
			{ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
		)
		return {
			...bounds,
			centerX: (bounds.minX + bounds.maxX) / 2,
			centerY: (bounds.minY + bounds.maxY) / 2,
		}
	}

	private notifyArrangementResult(result: ArrangementResult): void {
		const translate = this.canvas.t
		const translateText = (
			key: string,
			options: string | TOptions,
			fallback: string,
		): string => {
			const translationOptions =
				typeof options === "string" ? options : { defaultValue: fallback, ...options }
			const value = translate?.(key, translationOptions)
			return typeof value === "string" ? value : fallback
		}
		const details: string[] = []
		if (result.layerCount > 0) {
			details.push(
				translateText(
					"elementTools.elementDistribute.arrangementLayers",
					{ count: result.layerCount },
					`${result.layerCount} 层`,
				),
			)
		}
		if (result.isolatedNodeCount > 0) {
			details.push(
				translateText(
					"elementTools.elementDistribute.arrangementIsolated",
					{ count: result.isolatedNodeCount },
					`孤立 ${result.isolatedNodeCount}`,
				),
			)
		}
		if (result.cycleNodeCount > 0) {
			details.push(
				translateText(
					"elementTools.elementDistribute.arrangementCycles",
					{ count: result.cycleNodeCount },
					`循环 ${result.cycleNodeCount}`,
				),
			)
		}
		if (result.skippedLockedCount > 0) {
			details.push(
				translateText(
					"elementTools.elementDistribute.arrangementLocked",
					{ count: result.skippedLockedCount },
					`跳过锁定 ${result.skippedLockedCount}`,
				),
			)
		}
		const separator = translateText(
			"elementTools.elementDistribute.arrangementSeparator",
			"，",
			"，",
		)
		const detailText = details.join(separator)
		const message = details.length
			? translateText(
					"elementTools.elementDistribute.arrangementResultWithDetails",
					{ count: result.arrangedNodeCount, details: detailText },
					`已排列 ${result.arrangedNodeCount} 个节点（${detailText}）`,
				)
			: translateText(
					"elementTools.elementDistribute.arrangementResult",
					{ count: result.arrangedNodeCount },
					`已排列 ${result.arrangedNodeCount} 个节点`,
				)
		toast.success(message || `已排列 ${result.arrangedNodeCount} 个节点`)
	}

	private notifyArrangementUnchanged(): void {
		const message =
			this.canvas.t?.(
				"elementTools.elementDistribute.arrangementUnchanged",
				"选中节点已是整齐排列，无需调整",
			) || "选中节点已是整齐排列，无需调整"
		toast.info(message)
	}

	private notifyGeometryResult(
		kind: "alignment" | "spacing",
		count: number,
		skippedLockedCount: number,
	): void {
		const translate = this.canvas.t
		const translateText = (
			key: string,
			options: string | TOptions,
			fallback: string,
		): string => {
			const value = translate?.(key, options)
			return typeof value === "string" ? value : fallback
		}
		const details =
			skippedLockedCount > 0
				? translateText(
						"elementTools.elementDistribute.arrangementLocked",
						{ count: skippedLockedCount },
						`跳过锁定 ${skippedLockedCount}`,
					)
				: ""
		const fallback =
			kind === "alignment"
				? details
					? `已完成对齐 ${count} 个节点（${details}）`
					: `已完成对齐 ${count} 个节点`
				: details
					? `已完成间距分布 ${count} 个节点（${details}）`
					: `已完成间距分布 ${count} 个节点`
		const message =
			kind === "alignment"
				? details
					? translateText(
							"elementTools.elementDistribute.alignmentResultWithDetails",
							{ count, details },
							fallback,
						)
					: translateText(
							"elementTools.elementDistribute.alignmentResult",
							{ count },
							fallback,
						)
				: details
					? translateText(
							"elementTools.elementDistribute.spacingResultWithDetails",
							{ count, details },
							fallback,
						)
					: translateText(
							"elementTools.elementDistribute.spacingResult",
							{ count },
							fallback,
						)
		toast.success(message || fallback)
	}

	private notifyWarning(key: string, fallback: string): void {
		toast.warning(this.canvas.t?.(key, fallback) || fallback)
	}

	public destroy(): void {
		// No subscriptions are owned by the alignment manager.
	}
}

export type { ArrangementMode }
