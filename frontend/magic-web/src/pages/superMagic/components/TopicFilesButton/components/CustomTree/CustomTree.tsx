import { useVirtualScrollMargin } from "../../hooks/useVirtualScrollMargin"
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { cx } from "antd-style"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import type { TreeNodeData } from "../../utils/treeDataConverter"
import {
	getDragReceiverNode,
	getDragTargetBlockRange,
	resolveVisibleTreeScrollAnchor,
	resolveVisibleTreeScrollTopForAnchor,
	type VisibleTreeScrollAnchor,
	type VisibleTreeNodeRow,
} from "../../utils/visibleTreeRows"
import { scrollFileRowIntoContainer } from "../../utils/scrollFileRowIntoContainer"
import { useStyles } from "./style"
import {
	measureTreeSelect,
	recordTreeScrollAnchorMissing,
	recordTreeScrollAnchorRestore,
	useCustomTreePerfMetrics,
} from "./useCustomTreePerf"

const DEFAULT_VIRTUAL_THRESHOLD = 50
const DESKTOP_ROW_ESTIMATE = 32
const MOBILE_ROW_ESTIMATE = 42
const EMPTY_VIRTUAL_ITEMS: VirtualItem[] = []
type RowRenderVersion = string | number

interface TreeNodeRowProps {
	node: TreeNodeData
	dragReceiverNode?: TreeNodeData | null
	highlightDragTargetNode?: boolean
	selectedKeySet: Set<string>
	renderVersion?: RowRenderVersion
	onSelect: (key: string, node: TreeNodeData) => void
	titleRender?: (node: TreeNodeData) => React.ReactNode
	customTreeNodeClass: string
	dragTargetNodeClass?: string
	dragTargetKey?: React.Key | null
	isDragTargetNode?: (node: TreeNodeData) => boolean
	// 拖拽事件处理器
	onDragEnter?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragLeave?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragOver?: (e: React.DragEvent, node: TreeNodeData) => void
	onDrop?: (e: React.DragEvent, node: TreeNodeData) => void
}

function TreeNodeRow({
	node,
	dragReceiverNode,
	highlightDragTargetNode = true,
	selectedKeySet,
	onSelect,
	titleRender,
	customTreeNodeClass,
	dragTargetNodeClass,
	dragTargetKey,
	isDragTargetNode,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
}: TreeNodeRowProps) {
	const selected = selectedKeySet.has(String(node.key))
	const dragTargetNode = dragReceiverNode ?? null
	const dragReceiverKey = dragTargetNode ? String(dragTargetNode.key) : undefined

	const handleSelect = () => {
		onSelect(node.key, node)
	}

	const isSameDragReceiverTransition = (target: EventTarget | null) => {
		if (!dragReceiverKey || !(target instanceof Element)) return false

		const relatedReceiver = target.closest<HTMLElement>("[data-drag-receiver-key]")
		return relatedReceiver?.dataset.dragReceiverKey === dragReceiverKey
	}

	// 判断是否为拖拽目标节点
	const isDragTarget =
		dragTargetKey !== undefined
			? dragTargetKey !== null && String(dragTargetKey) === String(node.key)
			: isDragTargetNode
				? isDragTargetNode(node)
				: false

	const canReceiveDrag = Boolean(dragTargetNode)

	const handleDragEnter = (e: React.DragEvent) => {
		if (canReceiveDrag && onDragEnter && dragTargetNode) {
			if (isSameDragReceiverTransition(e.relatedTarget)) return
			onDragEnter(e, dragTargetNode)
		}
	}

	const handleDragLeave = (e: React.DragEvent) => {
		if (canReceiveDrag && onDragLeave && dragTargetNode) {
			if (isSameDragReceiverTransition(e.relatedTarget)) return
			onDragLeave(e, dragTargetNode)
		}
	}

	const handleDragOver = (e: React.DragEvent) => {
		if (canReceiveDrag && onDragOver && dragTargetNode) {
			onDragOver(e, dragTargetNode)
		}
	}

	const handleDrop = (e: React.DragEvent) => {
		if (canReceiveDrag && onDrop && dragTargetNode) {
			onDrop(e, dragTargetNode)
		}
	}

	return (
		<div
			className={cx(
				customTreeNodeClass,
				highlightDragTargetNode && isDragTarget && dragTargetNodeClass,
			)}
			data-drag-receiver-key={dragReceiverKey}
			{...(canReceiveDrag && {
				onDragEnter: handleDragEnter,
				onDragLeave: handleDragLeave,
				onDragOver: handleDragOver,
				onDrop: handleDrop,
			})}
		>
			{/* 当前节点 */}
			<div
				className={cx("magic-tree-treenode", {
					"magic-tree-treenode-selected": selected,
				})}
				onClick={handleSelect}
				data-testid="topic-files-tree-node"
			>
				<div className="magic-tree-node-content-wrapper">
					{titleRender ? titleRender(node) : node.title}
				</div>
			</div>
		</div>
	)
}

function getRowSelected(props: TreeNodeRowProps) {
	return props.selectedKeySet.has(String(props.node.key))
}

function getNodeKey(node?: TreeNodeData | null) {
	return node ? String(node.key) : ""
}

function getRowDragTarget(props: TreeNodeRowProps) {
	if (props.dragTargetKey !== undefined) {
		return (
			props.dragTargetKey !== null && String(props.dragTargetKey) === String(props.node.key)
		)
	}
	return props.isDragTargetNode ? props.isDragTargetNode(props.node) : false
}

function areTreeNodeRowPropsEqual(prev: TreeNodeRowProps, next: TreeNodeRowProps) {
	if (prev.node !== next.node) return false
	if (prev.renderVersion !== next.renderVersion) return false
	if (prev.highlightDragTargetNode !== next.highlightDragTargetNode) return false
	if (prev.onSelect !== next.onSelect) return false
	if (prev.titleRender !== next.titleRender) return false
	if (prev.customTreeNodeClass !== next.customTreeNodeClass) return false
	if (prev.dragTargetNodeClass !== next.dragTargetNodeClass) return false
	if (prev.onDragEnter !== next.onDragEnter) return false
	if (prev.onDragLeave !== next.onDragLeave) return false
	if (prev.onDragOver !== next.onDragOver) return false
	if (prev.onDrop !== next.onDrop) return false
	if (getRowSelected(prev) !== getRowSelected(next)) return false
	if (getNodeKey(prev.dragReceiverNode) !== getNodeKey(next.dragReceiverNode)) return false
	if (getRowDragTarget(prev) !== getRowDragTarget(next)) return false
	return true
}

const MemoTreeNodeRow = memo(TreeNodeRow, areTreeNodeRowPropsEqual)

interface CustomTreeProps {
	visibleRows: VisibleTreeNodeRow[]
	visibleNodes: TreeNodeData[]
	visibleNodeIndexByKey: ReadonlyMap<string, number>
	expandedKeys?: React.Key[]
	selectedKeys?: React.Key[]
	onSelect?: (selectedKeys: React.Key[], info: { selected: boolean; node: TreeNodeData }) => void
	titleRender?: (node: TreeNodeData) => React.ReactNode
	getRowRenderVersion?: (row: VisibleTreeNodeRow) => RowRenderVersion
	rowRenderContextVersion?: RowRenderVersion
	showIcon?: boolean
	blockNode?: boolean
	className?: string
	dragTargetNodeClass?: string
	dragTargetKey?: React.Key | null
	isDragTargetNode?: (node: TreeNodeData) => boolean
	scrollElementRef?: React.RefObject<HTMLElement>
	sharedScroll?: boolean
	scrollToKey?: React.Key | null
	virtualThreshold?: number
	isMobile?: boolean
	onMountedRowsChange?: (rows: VisibleTreeNodeRow[]) => void
	// 拖拽事件处理器
	onDragEnter?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragLeave?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragOver?: (e: React.DragEvent, node: TreeNodeData) => void
	onDrop?: (e: React.DragEvent, node: TreeNodeData) => void
}

function CustomTree({
	visibleRows,
	visibleNodes,
	visibleNodeIndexByKey,
	expandedKeys = [],
	selectedKeys = [],
	onSelect,
	titleRender,
	getRowRenderVersion,
	rowRenderContextVersion,
	className,
	dragTargetNodeClass,
	dragTargetKey,
	isDragTargetNode,
	scrollElementRef,
	sharedScroll = false,
	scrollToKey,
	virtualThreshold = DEFAULT_VIRTUAL_THRESHOLD,
	isMobile = false,
	onMountedRowsChange,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
}: CustomTreeProps) {
	const { styles } = useStyles()
	const { ref: treeRef, scrollMargin } = useVirtualScrollMargin(
		sharedScroll ? scrollElementRef : undefined,
	)
	const selectedKeySet = useMemo(() => new Set(selectedKeys.map(String)), [selectedKeys])
	const scrollAnchorRef = useRef<VisibleTreeScrollAnchor | null>(null)
	const previousVisibleNodesRef = useRef<TreeNodeData[] | null>(null)
	const shouldVirtualize = Boolean(scrollElementRef) && visibleNodes.length > virtualThreshold
	const rowEstimateSize = isMobile ? MOBILE_ROW_ESTIMATE : DESKTOP_ROW_ESTIMATE
	const getScrollElement = useCallback(
		() => scrollElementRef?.current ?? null,
		[scrollElementRef],
	)
	const estimateSize = useCallback(() => rowEstimateSize, [rowEstimateSize])
	const getItemKey = useCallback(
		(index: number) => visibleNodes[index]?.key ?? index,
		[visibleNodes],
	)
	const rowVirtualizer = useVirtualizer({
		count: visibleNodes.length,
		scrollMargin,
		getScrollElement,
		estimateSize,
		overscan: 8,
		getItemKey,
	})
	const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : EMPTY_VIRTUAL_ITEMS
	// Use the virtualizer's measured layout rather than multiplying the estimate.
	// Rows can be taller than the estimate (for example after a font/layout change),
	// and the accumulated difference otherwise leaves the rendered rows increasingly
	// out of sync with the scroll container near the end of a large list.
	const totalSize = shouldVirtualize
		? rowVirtualizer.getTotalSize()
		: visibleNodes.length * rowEstimateSize
	const dragTargetBlockRange = useMemo(
		() => getDragTargetBlockRange(visibleRows, dragTargetKey),
		[dragTargetKey, visibleRows],
	)
	const rootNodeCount = useMemo(
		() => visibleRows.reduce((count, row) => count + (row.node.level === 0 ? 1 : 0), 0),
		[visibleRows],
	)
	const dragTargetBlockStyle = useMemo(() => {
		if (!dragTargetBlockRange) return null

		return {
			top: dragTargetBlockRange.startIndex * rowEstimateSize,
			height: Math.max(
				rowEstimateSize,
				(dragTargetBlockRange.endIndex - dragTargetBlockRange.startIndex + 1) *
					rowEstimateSize,
			),
		}
	}, [dragTargetBlockRange, rowEstimateSize])
	const shouldShowDragTargetBlock = Boolean(dragTargetBlockStyle && dragTargetNodeClass)
	const mountedRows = useMemo(() => {
		if (!shouldVirtualize) return visibleRows

		return virtualItems
			.map((virtualItem) => visibleRows[virtualItem.index])
			.filter((row): row is VisibleTreeNodeRow => Boolean(row))
	}, [shouldVirtualize, virtualItems, visibleRows])

	useCustomTreePerfMetrics({
		rootNodeCount,
		expandedKeys,
		selectedKeys,
		visibleNodeCount: visibleNodes.length,
		mountedNodeCount: shouldVirtualize ? virtualItems.length : visibleNodes.length,
		virtualized: shouldVirtualize,
	})

	useEffect(() => {
		onMountedRowsChange?.(mountedRows)
	}, [mountedRows, onMountedRowsChange])

	const updateScrollAnchor = useCallback(() => {
		const scrollElement = scrollElementRef?.current
		if (!scrollElement) return

		if (
			sharedScroll &&
			(scrollElement.scrollTop < scrollMargin ||
				scrollElement.scrollTop >= scrollMargin + totalSize)
		) {
			scrollAnchorRef.current = null
			return
		}
		scrollAnchorRef.current = resolveVisibleTreeScrollAnchor(
			visibleNodes,
			Math.max(0, scrollElement.scrollTop - scrollMargin),
			rowEstimateSize,
		)
	}, [rowEstimateSize, scrollElementRef, visibleNodes, scrollMargin, sharedScroll, totalSize])

	useEffect(() => {
		const scrollElement = scrollElementRef?.current
		if (!scrollElement) return undefined

		updateScrollAnchor()
		scrollElement.addEventListener("scroll", updateScrollAnchor, { passive: true })
		return () => {
			scrollElement.removeEventListener("scroll", updateScrollAnchor)
		}
	}, [scrollElementRef, updateScrollAnchor])

	useLayoutEffect(() => {
		const scrollElement = scrollElementRef?.current
		const visibleNodesChanged = previousVisibleNodesRef.current !== visibleNodes

		if (scrollElement && visibleNodesChanged && !scrollToKey) {
			const anchor = scrollAnchorRef.current
			if (anchor) {
				const nextTreeScrollTop = resolveVisibleTreeScrollTopForAnchor(
					anchor,
					visibleNodeIndexByKey,
					rowEstimateSize,
				)

				if (nextTreeScrollTop !== null) {
					const nextScrollTop = nextTreeScrollTop + scrollMargin
					const deltaPx = nextScrollTop - scrollElement.scrollTop
					if (Math.abs(deltaPx) >= 1) {
						const restoreMode = shouldVirtualize ? "virtualizer" : "scroll_element"
						if (shouldVirtualize) {
							rowVirtualizer.scrollToOffset(nextScrollTop, {
								align: "start",
								behavior: "auto",
							})
						} else {
							scrollElement.scrollTop = nextScrollTop
						}
						recordTreeScrollAnchorRestore({
							anchor,
							nextIndex: visibleNodeIndexByKey.get(anchor.key),
							deltaPx,
							restoreMode,
							visibleNodesCount: visibleNodes.length,
						})
					}
				} else {
					recordTreeScrollAnchorMissing(anchor, visibleNodes.length)
				}
			}
		}

		previousVisibleNodesRef.current = visibleNodes
		updateScrollAnchor()
	}, [
		scrollMargin,
		rowEstimateSize,
		rowVirtualizer,
		scrollElementRef,
		scrollToKey,
		shouldVirtualize,
		updateScrollAnchor,
		visibleNodeIndexByKey,
		visibleNodes,
	])

	const handleSelect = useCallback(
		(key: string, node: TreeNodeData) => {
			if (!onSelect) return

			const isSelected = selectedKeySet.has(String(key))
			let newSelectedKeys: React.Key[]

			if (isSelected) {
				newSelectedKeys = selectedKeys.filter((k) => k !== key)
			} else {
				newSelectedKeys = [key] // Single-select mode
			}

			measureTreeSelect(newSelectedKeys, node, () => {
				onSelect(newSelectedKeys, { selected: !isSelected, node })
			})
		},
		[onSelect, selectedKeySet, selectedKeys],
	)

	// Short trees render every row, so the virtualizer never receives scrollToKey.
	// Scroll the file-list container here, before the parent confirms the locate.
	useLayoutEffect(() => {
		if (!scrollToKey || shouldVirtualize) return
		const scrollElement = scrollElementRef?.current
		if (!scrollElement) return

		const index = visibleNodeIndexByKey.get(String(scrollToKey))
		if (index === undefined) return
		const row = scrollElement.querySelector(`[data-index="${index}"]`)
		if (!(row instanceof HTMLElement)) return

		scrollFileRowIntoContainer(scrollElement, row)
	}, [scrollElementRef, scrollToKey, shouldVirtualize, visibleNodeIndexByKey, visibleNodes])

	useEffect(() => {
		if (!scrollToKey || !shouldVirtualize) return

		const index = visibleNodeIndexByKey.get(String(scrollToKey))
		if (index === undefined) return

		rowVirtualizer.scrollToIndex(index, {
			align: "center",
			behavior: "smooth",
		})
	}, [rowVirtualizer, scrollToKey, shouldVirtualize, visibleNodeIndexByKey])

	const renderRow = (row: VisibleTreeNodeRow, highlightDragTargetNode = true) => (
		<MemoTreeNodeRow
			node={row.node}
			dragReceiverNode={getDragReceiverNode(row)}
			highlightDragTargetNode={highlightDragTargetNode}
			selectedKeySet={selectedKeySet}
			renderVersion={`${rowRenderContextVersion ?? ""}:${getRowRenderVersion?.(row) ?? ""}`}
			onSelect={handleSelect}
			titleRender={titleRender}
			customTreeNodeClass={styles.customTreeNode}
			dragTargetNodeClass={dragTargetNodeClass}
			dragTargetKey={dragTargetKey}
			isDragTargetNode={isDragTargetNode}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		/>
	)

	const renderDragTargetBlock = () => {
		if (!dragTargetBlockStyle || !dragTargetNodeClass) return null

		return (
			<div
				className={dragTargetNodeClass}
				style={{
					position: "absolute",
					top: `${dragTargetBlockStyle.top}px`,
					left: 0,
					right: 0,
					height: `${dragTargetBlockStyle.height}px`,
					pointerEvents: "none",
					zIndex: 0,
				}}
			/>
		)
	}

	if (shouldVirtualize) {
		return (
			<div
				ref={treeRef}
				className={cx("magic-tree", className)}
				style={{
					height: `${totalSize}px`,
					position: "relative",
					width: "100%",
				}}
			>
				{renderDragTargetBlock()}
				{virtualItems.map((virtualItem) => {
					const row = visibleRows[virtualItem.index]
					if (!row) return null

					return (
						<div
							key={virtualItem.key}
							data-index={virtualItem.index}
							ref={rowVirtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								minHeight: `${rowEstimateSize}px`,
								width: "100%",
								transform: `translateY(${virtualItem.start - scrollMargin}px)`,
								zIndex: 1,
							}}
						>
							{renderRow(row, !shouldShowDragTargetBlock)}
						</div>
					)
				})}
			</div>
		)
	}

	return (
		<div
			ref={treeRef}
			className={cx("magic-tree", className)}
			style={{
				minHeight: `${totalSize}px`,
				position: "relative",
				width: "100%",
			}}
		>
			{renderDragTargetBlock()}
			{visibleRows.map((row, index) => (
				<div
					key={row.node.key}
					data-index={index}
					style={{
						position: "relative",
						minHeight: `${rowEstimateSize}px`,
						zIndex: 1,
					}}
				>
					{renderRow(row, !shouldShowDragTargetBlock)}
				</div>
			))}
		</div>
	)
}

export default memo(CustomTree)
