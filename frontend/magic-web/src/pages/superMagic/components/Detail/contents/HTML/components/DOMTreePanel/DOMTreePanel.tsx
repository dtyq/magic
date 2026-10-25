import * as React from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import {
	Ban,
	ChevronsDownUp,
	ChevronsUpDown,
	CornerDownRight,
	ArrowDown,
	ArrowUp,
	RefreshCw,
	GripVertical,
	Search,
	X,
} from "lucide-react"
import { createPortal } from "react-dom"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { manualPerfLogger } from "@/utils/manualPerfLogger"
import magicToast from "@/components/base/MagicToaster/utils"
import type { DomTreeNode, DomTreeResponse } from "../../iframe-bridge/types/messages"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { DOMTreeRow, type DOMTreeRowHandlers } from "./DOMTreeRow"
import { DOMTreeVirtualList } from "./DOMTreeVirtualList"
import { ActionTooltip } from "./DOMTreeRowControls"
import { useEditorSidebarSlots } from "../EditorSidebar/sidebarSlots"
import {
	DOM_TREE_ROW_HEIGHT,
	DOM_TREE_VIRTUAL_INITIAL_RECT,
	DOM_TREE_VIRTUAL_OVERSCAN,
	DOM_TREE_VIRTUAL_THRESHOLD,
	buildDomTreeIndex,
	collectNodeIds,
	collectVisibleNodeRows,
	estimateDomTreeRowSize,
	getDomTreeNodeDisplayLabel,
	getDomTreeSemanticLabel,
	getTextInsertPlacementLabel,
	getSemanticKey,
	isSelectableNode,
	type DeleteRequest,
	type DropPosition,
	type InsertPlacement,
	type TextInsertRequest,
} from "./domTreeModel"

interface Props {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	visible: boolean
	selectedSelector?: string
	contentRevision?: number
}

const DOM_TREE_FALLBACK_REFRESH_INTERVAL = 10_000
const DOM_TREE_CONTENT_REFRESH_DELAY = 120
const DOM_TREE_VIRTUAL_LOG_INTERVAL_MS = 250

interface DomMovePreviewTarget {
	nodeId: string
	position: DropPosition
}

interface DomMovePreviewSession {
	nodeId: string
	pendingTarget: DomMovePreviewTarget | null
	appliedTargetKey: string | null
	flushPromise: Promise<void> | null
	started: boolean
	flushing: boolean
	cancelled: boolean
	finalizing: boolean
}

function createDragPreview(label: string): HTMLElement {
	const preview = document.createElement("div")
	preview.textContent = label
	preview.className =
		"pointer-events-none fixed -left-[1000px] -top-[1000px] z-[2147483647] max-w-60 overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] border border-primary/70 bg-popover px-3 py-2 text-xs font-semibold leading-4 text-popover-foreground shadow-[0_8px_24px_rgba(15,23,42,0.2)]"
	document.body.appendChild(preview)
	return preview
}

function DOMTreePanelInner({ editorRef, visible, selectedSelector, contentRevision = 0 }: Props) {
	const { t } = useTranslation("super")
	const sidebarSlots = useEditorSidebarSlots()
	const [tree, setTree] = useState<DomTreeResponse | null>(null)
	const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [searchQuery, setSearchQuery] = useState("")
	const [activeSearchIndex, setActiveSearchIndex] = useState(0)
	const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
	const [dropTarget, setDropTarget] = useState<{
		nodeId: string
		position: DropPosition
	} | null>(null)
	const [invalidDropTargetId, setInvalidDropTargetId] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const [isBusy, setIsBusy] = useState(false)
	const [textInsertRequest, setTextInsertRequest] = useState<TextInsertRequest | null>(null)
	const [textInput, setTextInput] = useState("")
	const [openAddMenuKey, setOpenAddMenuKey] = useState<string | null>(null)
	const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
	const [clipboardNodeId, setClipboardNodeId] = useState<string | null>(null)
	const [clipboardMode, setClipboardMode] = useState<"copy" | "cut" | null>(null)
	const requestInFlightRef = useRef(false)
	const interactionLockedRef = useRef(false)
	const treeViewportRef = useRef<HTMLDivElement>(null)
	const selectedScrollFrameRef = useRef<number | null>(null)
	const autoScrollFrameRef = useRef<number | null>(null)
	const previousContentRevisionRef = useRef(contentRevision)
	const virtualRangeLogAtRef = useRef(0)
	const hoverBridgeLogRef = useRef<{
		hover_count: number
		clear_count: number
		timer: number | null
	}>({ hover_count: 0, clear_count: 0, timer: null })
	const draggedNodeIdRef = useRef<string | null>(null)
	const domMovePreviewRef = useRef<DomMovePreviewSession | null>(null)
	const recordHoverBridgeCall = useCallback((kind: "hover" | "clear") => {
		if (!manualPerfLogger.isEnabled()) return
		const stats = hoverBridgeLogRef.current
		if (kind === "hover") stats.hover_count += 1
		else stats.clear_count += 1
		if (stats.timer !== null) return
		stats.timer = window.setTimeout(() => {
			const nextStats = { ...stats }
			stats.hover_count = 0
			stats.clear_count = 0
			stats.timer = null
			if (nextStats.hover_count > 0 || nextStats.clear_count > 0) {
				manualPerfLogger.log("dom_tree_hover_bridge_batch", {
					hover_call_count: nextStats.hover_count,
					clear_call_count: nextStats.clear_count,
				})
			}
		}, DOM_TREE_VIRTUAL_LOG_INTERVAL_MS)
	}, [])
	const nodeButtonRefs = useRef(new Map<string, HTMLButtonElement>())
	const clearDragState = useCallback(() => {
		interactionLockedRef.current = false
		draggedNodeIdRef.current = null
		setDraggedNodeId(null)
		setDropTarget(null)
		setInvalidDropTargetId(null)
		if (autoScrollFrameRef.current !== null) {
			window.cancelAnimationFrame(autoScrollFrameRef.current)
			autoScrollFrameRef.current = null
		}
		void editorRef.current?.clearHoveredDomNode?.()
	}, [editorRef])
	const getDomMovePreviewTargetKey = useCallback((target: DomMovePreviewTarget) => {
		return `${target.nodeId}:${target.position}`
	}, [])
	const flushDomMovePreview = useCallback(
		async (session: DomMovePreviewSession): Promise<void> => {
			if (session.flushing) {
				if (session.flushPromise) await session.flushPromise
				if (
					!session.cancelled &&
					session.pendingTarget &&
					getDomMovePreviewTargetKey(session.pendingTarget) !== session.appliedTargetKey
				) {
					await flushDomMovePreview(session)
				}
				return
			}

			session.flushing = true
			let releaseFlush = () => {}
			// Keep this promise pending until work finishes so a sync skip cannot
			// pin a settled flushPromise and drop later targets.
			session.flushPromise = new Promise<void>((resolve) => {
				releaseFlush = resolve
			})
			try {
				if (!session.cancelled && !session.started) {
					await editorRef.current?.beginDomMovePreview?.(session.nodeId)
					session.started = true
				}

				while (!session.cancelled && session.pendingTarget) {
					const target = session.pendingTarget
					session.pendingTarget = null
					const targetKey = getDomMovePreviewTargetKey(target)
					if (targetKey === session.appliedTargetKey) continue

					const applied = await editorRef.current?.previewDomMove?.(
						session.nodeId,
						target.nodeId,
						target.position,
					)
					if (!session.cancelled) {
						if (applied === false) {
							setInvalidDropTargetId(target.nodeId)
						} else {
							session.appliedTargetKey = targetKey
						}
					}
				}
			} finally {
				session.flushing = false
				session.flushPromise = null
				releaseFlush()
			}
		},
		[editorRef, getDomMovePreviewTargetKey],
	)
	const queueDomMovePreview = useCallback(
		(target: DomMovePreviewTarget) => {
			const session = domMovePreviewRef.current
			if (!session || session.cancelled || session.finalizing) return
			session.pendingTarget = target
			if (session.flushPromise) return
			void flushDomMovePreview(session).catch((error) => {
				if (domMovePreviewRef.current !== session) return
				session.cancelled = true
				domMovePreviewRef.current = null
				void editorRef.current?.cancelDomMovePreview?.().catch((cancelError) => {
					console.warn("恢复 DOM 移动预览失败", cancelError)
				})
				console.warn("DOM 移动预览失败", error)
			})
		},
		[editorRef, flushDomMovePreview],
	)
	const cancelDomMovePreview = useCallback(async () => {
		const session = domMovePreviewRef.current
		if (!session || session.finalizing) return
		session.cancelled = true
		domMovePreviewRef.current = null
		try {
			if (session.flushPromise) await session.flushPromise
			await editorRef.current?.cancelDomMovePreview?.()
		} catch (error) {
			console.warn("取消 DOM 移动预览失败", error)
		}
	}, [editorRef])
	const finishDomMovePreview = useCallback(
		async (target: DomMovePreviewTarget): Promise<boolean> => {
			const session = domMovePreviewRef.current
			if (!session || session.cancelled) return false
			session.finalizing = true
			try {
				// Let in-flight previews settle before forcing a fresh check of the drop target.
				// Otherwise an earlier response for the same target can skip the final check.
				if (session.flushPromise) await session.flushPromise
				if (session.cancelled) return false
				session.appliedTargetKey = null
				session.pendingTarget = target
				await flushDomMovePreview(session)
				if (
					session.cancelled ||
					session.appliedTargetKey !== getDomMovePreviewTargetKey(target)
				) {
					session.cancelled = true
					await editorRef.current?.cancelDomMovePreview?.()
					return false
				}
				await editorRef.current?.commitDomMovePreview?.()
				return true
			} catch (error) {
				console.warn("提交 DOM 移动预览失败", error)
				session.cancelled = true
				try {
					await editorRef.current?.cancelDomMovePreview?.()
				} catch (cancelError) {
					console.warn("恢复 DOM 移动预览失败", cancelError)
				}
				return false
			} finally {
				domMovePreviewRef.current = null
			}
		},
		[editorRef, flushDomMovePreview, getDomMovePreviewTargetKey],
	)
	const resetDragState = useCallback(() => {
		clearDragState()
		if (!domMovePreviewRef.current?.finalizing) void cancelDomMovePreview()
	}, [cancelDomMovePreview, clearDragState])
	const treeIndex = useMemo(() => {
		const startedAt = manualPerfLogger.isEnabled() ? manualPerfLogger.now() : 0
		const index = buildDomTreeIndex(tree?.root)
		if (startedAt) {
			manualPerfLogger.recordDuration("dom_tree_index", startedAt, {
				node_count: index.nodeMap.size,
			})
		}
		return index
	}, [tree])
	const { nodeMap, parentMap, nodeIdBySelector } = treeIndex
	const allNodesExpanded = Boolean(tree && expanded.size >= nodeMap.size)
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()
	const searchIndex = useMemo(
		() =>
			Array.from(nodeMap.values()).map((node) => ({
				node,
				searchableText: [
					node.label,
					node.tagName,
					node.textContent,
					node.selector,
					node.resource,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase(),
			})),
		[nodeMap],
	)
	const searchResults = useMemo(() => {
		if (!normalizedSearchQuery) return []
		return searchIndex
			.filter(({ searchableText }) => searchableText.includes(normalizedSearchQuery))
			.map(({ node }) => node)
	}, [normalizedSearchQuery, searchIndex])
	const visibleSearchResults = useMemo(() => searchResults.slice(0, 30), [searchResults])
	const visibleRows = useMemo(() => {
		const startedAt = manualPerfLogger.isEnabled() ? manualPerfLogger.now() : 0
		const rows = tree ? collectVisibleNodeRows(tree.root, expanded) : []
		if (startedAt) {
			manualPerfLogger.recordDuration("dom_tree_visible_rows", startedAt, {
				node_count: nodeMap.size,
				visible_row_count: rows.length,
			})
		}
		return rows
	}, [expanded, nodeMap.size, tree])
	const visibleNodeIds = useMemo(() => visibleRows.map((row) => row.nodeId), [visibleRows])
	const focusableNodeIds = useMemo(
		() =>
			visibleNodeIds.filter((nodeId) => {
				const node = nodeMap.get(nodeId)
				return node ? isSelectableNode(node) : false
			}),
		[nodeMap, visibleNodeIds],
	)
	const shouldVirtualize = visibleRows.length > DOM_TREE_VIRTUAL_THRESHOLD
	const draggedRowIndex = draggedNodeId
		? visibleRows.findIndex((row) => row.nodeId === draggedNodeId)
		: -1
	const virtualRangeExtractor = useCallback(
		(range: Parameters<typeof defaultRangeExtractor>[0]) => {
			const indexes = defaultRangeExtractor(range)
			if (draggedRowIndex < 0 || indexes.includes(draggedRowIndex)) return indexes

			// Native drag requires the source row to remain mounted while the list scrolls.
			return [...indexes, draggedRowIndex].sort((a, b) => a - b)
		},
		[draggedRowIndex],
	)
	const getTreeScrollElement = useCallback(() => treeViewportRef.current, [])
	const getVirtualRowKey = useCallback(
		(index: number) => visibleRows[index]?.nodeId ?? index,
		[visibleRows],
	)
	const virtualizerOptions = useMemo(
		() => ({
			count: visibleRows.length,
			getScrollElement: getTreeScrollElement,
			// Radix ScrollArea attaches its viewport after the first render. A small
			// initial rect prevents a blank tree during that handoff; the virtualizer
			// replaces it with the measured viewport as soon as the element is ready.
			initialRect: DOM_TREE_VIRTUAL_INITIAL_RECT,
			estimateSize: estimateDomTreeRowSize,
			getItemKey: getVirtualRowKey,
			overscan: DOM_TREE_VIRTUAL_OVERSCAN,
			rangeExtractor: virtualRangeExtractor,
		}),
		[visibleRows.length, getTreeScrollElement, getVirtualRowKey, virtualRangeExtractor],
	)
	const treeVirtualizer = useVirtualizer(virtualizerOptions)
	const virtualItems = shouldVirtualize ? treeVirtualizer.getVirtualItems() : undefined
	const virtualItemsForRender = useMemo(() => {
		if (!shouldVirtualize) return []
		if (virtualItems && virtualItems.length > 0) return virtualItems

		// Keep the first viewport usable before Radix reports its actual size. This
		// also covers a temporarily hidden panel; the virtualizer replaces these
		// rows after the scroll element becomes measurable.
		return visibleRows.slice(0, 18).map((_, index) => ({
			index,
			key: visibleRows[index]?.nodeId ?? index,
			start: index * DOM_TREE_ROW_HEIGHT,
		}))
	}, [shouldVirtualize, virtualItems, visibleRows])
	const virtualRowRenderStateToken = useMemo(
		() => ({
			t,
			tree,
			expanded,
			selectedNodeId,
			hoveredNodeId,
			draggedNodeId,
			dropTarget,
			invalidDropTargetId,
			isBusy,
			openAddMenuKey,
			clipboardNodeId,
			clipboardMode,
			nodeMap,
			parentMap,
			focusableNodeIds,
		}),
		[
			t,
			tree,
			expanded,
			selectedNodeId,
			hoveredNodeId,
			draggedNodeId,
			dropTarget,
			invalidDropTargetId,
			isBusy,
			openAddMenuKey,
			clipboardNodeId,
			clipboardMode,
			nodeMap,
			parentMap,
			focusableNodeIds,
		],
	)
	const draggedNode = draggedNodeId ? nodeMap.get(draggedNodeId) : undefined
	const dropTargetNode = dropTarget ? nodeMap.get(dropTarget.nodeId) : undefined
	const invalidDropTarget = invalidDropTargetId ? nodeMap.get(invalidDropTargetId) : undefined
	const toggleExpanded = useCallback((nodeId: string) => {
		setExpanded((current) => {
			const next = new Set(current)
			if (next.has(nodeId)) next.delete(nodeId)
			else next.add(nodeId)
			return next
		})
	}, [])
	const expandAll = useCallback(() => {
		if (tree) setExpanded(collectNodeIds(tree.root))
	}, [tree])
	const collapseAll = useCallback(() => {
		if (tree) setExpanded(new Set([tree.root.nodeId]))
	}, [tree])
	const getNodeHint = useCallback(
		(node: DomTreeNode) => {
			const reasonKey =
				node.disabledReason === "运行时或非可视节点"
					? "excluded"
					: node.disabledReason === "根节点不可移动或删除"
						? "root"
						: node.disabledReason === "节点定位不唯一"
							? "nonUnique"
							: null
			const reason =
				reasonKey === "excluded"
					? t("stylePanel.domTree.disabledReasons.excluded")
					: reasonKey === "root"
						? t("stylePanel.domTree.disabledReasons.root")
						: reasonKey === "nonUnique"
							? t("stylePanel.domTree.disabledReasons.nonUnique")
							: node.disabledReason
			const warning = node.dynamicWarning
				? node.dynamicWarning === "该节点可能由脚本重新渲染，修改后可能被覆盖"
					? t("stylePanel.domTree.dynamicWarning")
					: node.dynamicWarning
				: undefined
			return [reason, warning, node.selector].filter(Boolean).join(" · ")
		},
		[t],
	)

	const refresh = useCallback(
		async (force = false) => {
			// The bridge request can take several seconds while the iframe runtime activates.
			// Ignore a tick while one request is pending so polling cannot create a timeout queue.
			if (requestInFlightRef.current || (!force && interactionLockedRef.current)) return
			const startedAt = manualPerfLogger.isEnabled() ? manualPerfLogger.now() : 0
			let perfData: Record<string, unknown> = { force }
			requestInFlightRef.current = true
			setLoadState((current) => (current === "ready" ? current : "loading"))
			try {
				const next = await editorRef.current?.getDomTree()
				perfData = { force, has_root: Boolean(next?.root) }
				if (!force && interactionLockedRef.current) {
					perfData.reason = "interaction_locked"
					return
				}
				// A null result means the host bridge is not ready yet. Keep the loading
				// state so the next scheduled retry can render the tree without flashing an error.
				if (!next?.root) {
					perfData.reason = "runtime_not_ready"
					setLoadState("loading")
					return
				}
				setTree(next)
				setLoadState("ready")
				if (next.clipboard) {
					if (next.clipboard.hasContent) {
						// The source node may have been cut and no longer exist in the tree.
						// A sentinel is enough here because the bridge owns the actual HTML.
						setClipboardNodeId("__runtime_clipboard__")
						setClipboardMode(next.clipboard.mode ?? "copy")
					} else {
						setClipboardNodeId(null)
						setClipboardMode(null)
					}
				}
				const nextNodeIds = collectNodeIds(next.root)
				perfData.node_count = nextNodeIds.size
				setExpanded((current) => {
					// Expand the initial tree by default, then preserve the user's
					// disclosure choices while polling or after a structure edit.
					if (current.size === 0) return nextNodeIds
					const preserved = new Set(
						[...current].filter((nodeId) => nextNodeIds.has(nodeId)),
					)
					return preserved.size > 0 ? preserved : nextNodeIds
				})
				setSelectedNodeId((current) =>
					current && nextNodeIds.has(current) ? current : null,
				)
				setHoveredNodeId((current) =>
					current && nextNodeIds.has(current) ? current : null,
				)
			} catch (error) {
				perfData = { force, error: true }
				console.warn("读取 DOM 树失败", error)
				setLoadState("error")
			} finally {
				if (startedAt) {
					manualPerfLogger.recordDuration("dom_tree_refresh", startedAt, perfData)
				}
				requestInFlightRef.current = false
			}
		},
		[editorRef],
	)

	useEffect(() => {
		const editor = editorRef.current
		if (!visible) {
			setHoveredNodeId(null)
			resetDragState()
			void editor?.clearHoveredDomNode?.()
			return
		}
		setTree(null)
		setLoadState("loading")
		void refresh()
		const timer = window.setInterval(() => void refresh(), DOM_TREE_FALLBACK_REFRESH_INTERVAL)
		return () => {
			window.clearInterval(timer)
			resetDragState()
			void editor?.clearHoveredDomNode?.()
		}
	}, [editorRef, refresh, resetDragState, visible])

	useEffect(
		() => () => {
			const timer = hoverBridgeLogRef.current.timer
			if (timer !== null) window.clearTimeout(timer)
		},
		[],
	)

	useEffect(() => {
		if (!visible) {
			previousContentRevisionRef.current = contentRevision
			return
		}
		if (previousContentRevisionRef.current === contentRevision) return
		previousContentRevisionRef.current = contentRevision
		const timer = window.setTimeout(() => void refresh(), DOM_TREE_CONTENT_REFRESH_DELAY)
		return () => window.clearTimeout(timer)
	}, [contentRevision, refresh, visible])

	useEffect(() => {
		if (!selectedSelector) {
			setSelectedNodeId(null)
			return
		}
		setSelectedNodeId(nodeIdBySelector.get(selectedSelector) ?? null)
	}, [nodeIdBySelector, selectedSelector])

	useEffect(() => {
		setActiveSearchIndex(0)
	}, [normalizedSearchQuery])

	useEffect(() => {
		if (!visible || !selectedNodeId) return
		const rowIndex = visibleRows.findIndex((row) => row.nodeId === selectedNodeId)
		if (rowIndex < 0) return

		let attempts = 0
		const scrollSelectedNode = () => {
			const selectedButton = nodeButtonRefs.current.get(selectedNodeId)
			if (selectedButton) {
				selectedButton.scrollIntoView?.({
					block: "nearest",
					inline: "nearest",
				})
				return
			}

			// Virtual rows are mounted after scrollToIndex. Retry a few animation
			// frames so selection does not depend on the browser's render timing.
			if (shouldVirtualize && attempts < 2) {
				attempts += 1
				treeVirtualizer.scrollToIndex(rowIndex, { align: "auto" })
				selectedScrollFrameRef.current = window.requestAnimationFrame(scrollSelectedNode)
			}
		}
		if (selectedScrollFrameRef.current !== null) {
			window.cancelAnimationFrame(selectedScrollFrameRef.current)
		}
		selectedScrollFrameRef.current = window.requestAnimationFrame(() => {
			selectedScrollFrameRef.current = null
			scrollSelectedNode()
		})
		return () => {
			if (selectedScrollFrameRef.current !== null) {
				window.cancelAnimationFrame(selectedScrollFrameRef.current)
				selectedScrollFrameRef.current = null
			}
		}
	}, [selectedNodeId, shouldVirtualize, treeVirtualizer, visible, visibleRows])

	useEffect(() => {
		if (!shouldVirtualize || !manualPerfLogger.isEnabled()) return
		const timestamp = manualPerfLogger.now()
		const isScrolling = treeVirtualizer.isScrolling
		if (
			isScrolling &&
			timestamp - virtualRangeLogAtRef.current < DOM_TREE_VIRTUAL_LOG_INTERVAL_MS
		)
			return

		virtualRangeLogAtRef.current = timestamp
		const firstItem = virtualItemsForRender[0]
		const lastItem = virtualItemsForRender[virtualItemsForRender.length - 1]
		manualPerfLogger.log("dom_tree_virtual_range", {
			total_row_count: visibleRows.length,
			mounted_row_count: virtualItemsForRender.length,
			first_index: firstItem?.index ?? -1,
			last_index: lastItem?.index ?? -1,
			total_size_px: treeVirtualizer.getTotalSize(),
			is_scrolling: isScrolling,
		})
	}, [shouldVirtualize, treeVirtualizer, virtualItemsForRender, visibleRows.length])

	useEffect(() => {
		if (!draggedNodeId) return
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") resetDragState()
		}
		const handleDragEnd = () => resetDragState()
		const handleWindowBlur = () => resetDragState()
		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("dragend", handleDragEnd)
		window.addEventListener("blur", handleWindowBlur)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("dragend", handleDragEnd)
			window.removeEventListener("blur", handleWindowBlur)
		}
	}, [draggedNodeId, resetDragState])

	const selectNode = useCallback(
		async (node: DomTreeNode) => {
			if (!isSelectableNode(node)) return
			setSelectedNodeId(node.nodeId)
			try {
				await editorRef.current?.selectDomNode(node.nodeId)
				await editorRef.current?.scrollToDomNode(node.nodeId)
			} catch (error) {
				setSelectedNodeId(null)
				setActionError(
					error instanceof Error ? error.message : t("stylePanel.domTree.actionFailed"),
				)
			}
		},
		[editorRef, t],
	)

	const focusSearchResult = useCallback(
		(node: DomTreeNode, resultIndex: number) => {
			setActiveSearchIndex(resultIndex)
			setExpanded((current) => {
				const next = new Set(current)
				let parent = parentMap.get(node.nodeId)
				while (parent) {
					next.add(parent.nodeId)
					parent = parentMap.get(parent.nodeId)
				}
				return next.size === current.size ? current : next
			})
			void selectNode(node)
		},
		[parentMap, selectNode],
	)

	const isInvalidDrop = useCallback(
		(sourceId: string, targetId: string) => {
			if (sourceId === targetId) return true
			let current = nodeMap.get(targetId)
			while (current) {
				const parent = parentMap.get(current.nodeId)
				if (!parent) return false
				if (parent.nodeId === sourceId) return true
				current = parent
			}
			return false
		},
		[nodeMap, parentMap],
	)
	const scheduleAutoScroll = useCallback((direction: -1 | 1) => {
		if (autoScrollFrameRef.current !== null) return
		autoScrollFrameRef.current = window.requestAnimationFrame(() => {
			autoScrollFrameRef.current = null
			treeViewportRef.current?.scrollBy({ top: direction * 12, behavior: "auto" })
		})
	}, [])

	const runAction = useCallback(
		async (action: () => Promise<void>): Promise<boolean> => {
			if (isBusy) return false
			setActionError(null)
			setOpenAddMenuKey(null)
			setIsBusy(true)
			try {
				await action()
				await refresh(true)
				return true
			} catch (error) {
				setActionError(
					error instanceof Error ? error.message : t("stylePanel.domTree.actionFailed"),
				)
				return false
			} finally {
				setIsBusy(false)
			}
		},
		[isBusy, refresh, t],
	)

	const getInsertionTarget = (node: DomTreeNode, placement: InsertPlacement) => {
		if (placement === "inside") {
			return node.canHaveChildren ? { parent: node, index: undefined } : null
		}

		const parent = parentMap.get(node.nodeId)
		if (!parent) return null
		return {
			parent,
			index:
				parent.children.findIndex((child) => child.nodeId === node.nodeId) +
				(placement === "after" ? 1 : 0),
		}
	}
	const getSemanticLabel = (node?: DomTreeNode) =>
		node ? getDomTreeSemanticLabel(t, getSemanticKey(node.tagName)) : ""
	const getNodeDisplayLabel = (node?: DomTreeNode) =>
		node ? getDomTreeNodeDisplayLabel(node, getSemanticLabel(node)) : ""

	const getPasteTarget = useCallback(
		(node: DomTreeNode) => {
			if (node.canHaveChildren && (node.editable || tree?.root.nodeId === node.nodeId)) {
				return { parentNodeId: node.nodeId, index: undefined }
			}
			const parent = parentMap.get(node.nodeId)
			if (!parent) return null
			const index = parent.children.findIndex((child) => child.nodeId === node.nodeId)
			return index < 0 ? null : { parentNodeId: parent.nodeId, index: index + 1 }
		},
		[parentMap, tree],
	)

	const addText = (node: DomTreeNode, placement: InsertPlacement) => {
		const target = getInsertionTarget(node, placement)
		if (!target) return
		setTextInput("")
		setTextInsertRequest({
			parentNodeId: target.parent.nodeId,
			index: target.index,
			targetLabel: getNodeDisplayLabel(node),
			placement,
		})
	}

	const submitTextInsert = async () => {
		const request = textInsertRequest
		const text = textInput.trim()
		if (!request || !text) return
		setTextInsertRequest(null)
		await runAction(
			() =>
				editorRef.current?.insertTextNode(request.parentNodeId, text, request.index) ??
				Promise.resolve(),
		)
	}

	const addImage = async (node: DomTreeNode, placement: InsertPlacement) => {
		const target = getInsertionTarget(node, placement)
		if (!target) return
		await runAction(
			() =>
				editorRef.current?.insertImageNode(target.parent.nodeId, target.index) ??
				Promise.resolve(),
		)
	}

	const deleteNode = async (request: DeleteRequest) => {
		setDeleteRequest(null)
		await runAction(
			() => editorRef.current?.deleteElement(request.selector) ?? Promise.resolve(),
		)
	}

	const copyNode = async (node: DomTreeNode) => {
		if (!node.canMove) return
		const succeeded = await runAction(async () => {
			const editor = editorRef.current
			if (!editor?.copyDomNode) {
				throw new Error(t("stylePanel.domTree.bridgeUnavailable"))
			}
			await editor.copyDomNode(node.nodeId)
			setClipboardNodeId(node.nodeId)
			setClipboardMode("copy")
		})
		if (succeeded) magicToast.success(t("stylePanel.domTree.copySuccess"))
	}

	const cutNode = async (node: DomTreeNode) => {
		if (!node.canMove) return
		const succeeded = await runAction(async () => {
			const editor = editorRef.current
			if (!editor?.cutDomNode) {
				throw new Error(t("stylePanel.domTree.bridgeUnavailable"))
			}
			await editor.cutDomNode(node.nodeId)
			setClipboardNodeId(node.nodeId)
			setClipboardMode("cut")
		})
		if (succeeded) magicToast.success(t("stylePanel.domTree.cutSuccess"))
	}

	const pasteNode = async (node: DomTreeNode) => {
		if (!clipboardNodeId) return
		const target = getPasteTarget(node)
		if (!target) return
		const succeeded = await runAction(async () => {
			const editor = editorRef.current
			if (!editor?.pasteDomNode) {
				throw new Error(t("stylePanel.domTree.bridgeUnavailable"))
			}
			await editor.pasteDomNode(target.parentNodeId, target.index)
		})
		if (succeeded && clipboardMode === "cut") {
			setClipboardNodeId(null)
			setClipboardMode(null)
		}
		if (succeeded) magicToast.success(t("stylePanel.domTree.pasteSuccess"))
	}

	const getShortcutModifier = () =>
		typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")
			? "metaKey"
			: "ctrlKey"

	const handleNodeShortcut = async (
		event: React.KeyboardEvent<HTMLButtonElement>,
		node: DomTreeNode,
	) => {
		if (event.altKey || event.isComposing) return
		const modifier = getShortcutModifier()
		const hasModifier = modifier === "metaKey" ? event.metaKey : event.ctrlKey
		if (hasModifier && !event.shiftKey) {
			switch (event.key.toLowerCase()) {
				case "c":
					event.preventDefault()
					await copyNode(node)
					return
				case "x":
					event.preventDefault()
					await cutNode(node)
					return
				case "v":
					event.preventDefault()
					await pasteNode(node)
					return
			}
		}
	}

	const remove = async (node: DomTreeNode) => {
		if (!node.canDelete || !node.selector) return
		if (node.children.length > 0) {
			setDeleteRequest({ selector: node.selector, targetLabel: node.label })
			return
		}
		await deleteNode({ selector: node.selector, targetLabel: node.label })
	}

	const duplicate = async (node: DomTreeNode) => {
		if (!node.editable) return
		await runAction(
			() =>
				editorRef.current?.duplicateDomNode?.(node.nodeId) ??
				editorRef.current?.duplicateElement(node.selector) ??
				Promise.resolve(),
		)
	}

	const moveToAdjacent = async (node: DomTreeNode, direction: -1 | 1) => {
		const parent = parentMap.get(node.nodeId)
		if (!parent || !node.canMove) return
		const index = parent.children.findIndex((child) => child.nodeId === node.nodeId)
		// The runtime index is the insertion point before a child. Moving down
		// therefore skips both the current node and the next sibling.
		const targetIndex = direction < 0 ? index - 1 : index + 2
		if (targetIndex < 0 || targetIndex > parent.children.length) return
		await runAction(
			() =>
				editorRef.current?.moveDomNode(node.nodeId, parent.nodeId, targetIndex) ??
				Promise.resolve(),
		)
	}

	const dropNode = async (event: React.DragEvent, target: DomTreeNode) => {
		event.preventDefault()
		const activeDraggedNodeId = draggedNodeIdRef.current ?? draggedNodeId
		if (
			!activeDraggedNodeId ||
			!dropTarget ||
			dropTarget.nodeId !== target.nodeId ||
			isInvalidDrop(activeDraggedNodeId, target.nodeId)
		) {
			resetDragState()
			return
		}
		const position = dropTarget.position
		const previewTarget = { nodeId: target.nodeId, position }
		if (position === "inside") {
			if (
				!target.canHaveChildren ||
				(!target.editable && target.nodeId !== tree?.root.nodeId)
			) {
				resetDragState()
				return
			}
			if (domMovePreviewRef.current) {
				await runAction(async () => {
					if (!(await finishDomMovePreview(previewTarget))) {
						throw new Error(t("stylePanel.domTree.actionFailed"))
					}
				})
			} else {
				await runAction(
					() =>
						editorRef.current?.moveDomNode(
							activeDraggedNodeId,
							target.nodeId,
							target.children.length,
						) ?? Promise.resolve(),
				)
			}
		} else {
			const parent = parentMap.get(target.nodeId)
			if (!parent) {
				resetDragState()
				return
			}
			const index = parent.children.findIndex((child) => child.nodeId === target.nodeId)
			if (domMovePreviewRef.current) {
				await runAction(async () => {
					if (!(await finishDomMovePreview(previewTarget))) {
						throw new Error(t("stylePanel.domTree.actionFailed"))
					}
				})
			} else {
				await runAction(
					() =>
						editorRef.current?.moveDomNode(
							activeDraggedNodeId,
							parent.nodeId,
							index + (position === "after" ? 1 : 0),
						) ?? Promise.resolve(),
				)
			}
		}
		clearDragState()
	}

	const getDragStatus = () => {
		if (!draggedNode) return t("stylePanel.domTree.dragHint")
		if (invalidDropTarget) {
			return t("stylePanel.domTree.dropInvalid", {
				node: getNodeDisplayLabel(invalidDropTarget),
			})
		}
		if (!dropTarget || !dropTargetNode) {
			return t("stylePanel.domTree.dragging", {
				node: getNodeDisplayLabel(draggedNode),
			})
		}
		const key =
			dropTarget.position === "inside"
				? "dropInside"
				: dropTarget.position === "before"
					? "dropBefore"
					: "dropAfter"
		return t(`stylePanel.domTree.${key}`, {
			node: getNodeDisplayLabel(dropTargetNode),
		})
	}
	const dragStatusIcon = invalidDropTarget ? (
		<Ban className="h-3.5 w-3.5 shrink-0" />
	) : dropTarget?.position === "before" ? (
		<ArrowUp className="h-3.5 w-3.5 shrink-0" />
	) : dropTarget?.position === "after" ? (
		<ArrowDown className="h-3.5 w-3.5 shrink-0" />
	) : dropTarget?.position === "inside" ? (
		<CornerDownRight className="h-3.5 w-3.5 shrink-0" />
	) : (
		<GripVertical className="h-3.5 w-3.5 shrink-0" />
	)
	const handleDragOver = useCallback(
		(event: React.DragEvent<HTMLDivElement>, node: DomTreeNode) => {
			event.preventDefault()
			setHoveredNodeId(null)
			event.dataTransfer.dropEffect = "move"
			const viewport = treeViewportRef.current
			if (viewport && typeof viewport.scrollBy === "function") {
				const viewportRect = viewport.getBoundingClientRect()
				const edgeDistance = 28
				if (event.clientY < viewportRect.top + edgeDistance) scheduleAutoScroll(-1)
				else if (event.clientY > viewportRect.bottom - edgeDistance) scheduleAutoScroll(1)
			}
			const isRootNode =
				tree?.root.nodeId === node.nodeId || node.tagName.toLowerCase() === "body"
			const canInsertInside = node.canHaveChildren && (node.editable || isRootNode)
			const canInsertSibling = parentMap.has(node.nodeId) && node.editable
			const activeDraggedNodeId = draggedNodeIdRef.current ?? draggedNodeId
			const isInvalidTarget =
				!activeDraggedNodeId ||
				isInvalidDrop(activeDraggedNodeId, node.nodeId) ||
				(!node.canHaveChildren && !node.editable)
			if (isInvalidTarget) {
				event.dataTransfer.dropEffect = "none"
				setDropTarget(null)
				setInvalidDropTargetId(activeDraggedNodeId ? node.nodeId : null)
				return
			}
			const rect = event.currentTarget.getBoundingClientRect()
			const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0
			const position: DropPosition =
				(tree?.root.nodeId === node.nodeId && node.canHaveChildren) ||
				(node.canHaveChildren && ratio >= 0.25 && ratio <= 0.75)
					? "inside"
					: ratio < 0.5
						? "before"
						: "after"
			if (
				(position === "inside" && !canInsertInside) ||
				(position !== "inside" && !canInsertSibling)
			) {
				setDropTarget(null)
				setInvalidDropTargetId(node.nodeId)
				event.dataTransfer.dropEffect = "none"
				return
			}
			setInvalidDropTargetId(null)
			setDropTarget((current) =>
				current?.nodeId === node.nodeId && current.position === position
					? current
					: { nodeId: node.nodeId, position },
			)
			queueDomMovePreview({ nodeId: node.nodeId, position })
		},
		[draggedNodeId, isInvalidDrop, parentMap, queueDomMovePreview, scheduleAutoScroll, tree],
	)
	const handleDragLeave = useCallback(
		(event: React.DragEvent<HTMLDivElement>, node: DomTreeNode) => {
			if (
				event.relatedTarget instanceof Node &&
				event.currentTarget.contains(event.relatedTarget)
			)
				return
			if (dropTarget?.nodeId === node.nodeId) setDropTarget(null)
			if (invalidDropTargetId === node.nodeId) setInvalidDropTargetId(null)
		},
		[dropTarget, invalidDropTargetId],
	)
	const handleDragStart = useCallback(
		(event: React.DragEvent<HTMLSpanElement>, node: DomTreeNode, semanticLabel: string) => {
			if (!node.canMove) return
			interactionLockedRef.current = true
			setActionError(null)
			setOpenAddMenuKey(null)
			setHoveredNodeId(null)
			setInvalidDropTargetId(null)
			setDropTarget(null)
			setDraggedNodeId(node.nodeId)
			draggedNodeIdRef.current = node.nodeId
			const editor = editorRef.current
			if (
				editor?.beginDomMovePreview &&
				editor.previewDomMove &&
				editor.commitDomMovePreview &&
				editor.cancelDomMovePreview
			) {
				const session: DomMovePreviewSession = {
					nodeId: node.nodeId,
					pendingTarget: null,
					appliedTargetKey: null,
					flushPromise: null,
					started: false,
					flushing: false,
					cancelled: false,
					finalizing: false,
				}
				domMovePreviewRef.current = session
				void flushDomMovePreview(session).catch((error) => {
					if (domMovePreviewRef.current === session) {
						domMovePreviewRef.current = null
					}
					void editorRef.current?.cancelDomMovePreview?.().catch((cancelError) => {
						console.warn("恢复 DOM 移动预览失败", cancelError)
					})
					console.warn("启动 DOM 移动预览失败", error)
				})
			}
			event.dataTransfer.effectAllowed = "move"
			event.dataTransfer.setData("text/plain", node.nodeId)
			if (event.dataTransfer.setDragImage) {
				const preview = createDragPreview(`${semanticLabel} · ${node.label}`)
				event.dataTransfer.setDragImage(preview, 12, 16)
				window.requestAnimationFrame(() => preview.remove())
			}
		},
		[editorRef, flushDomMovePreview],
	)
	const handleMouseEnter = useCallback(
		(node: DomTreeNode) => {
			setHoveredNodeId(node.nodeId)
			if (!draggedNodeId && isSelectableNode(node)) {
				recordHoverBridgeCall("hover")
				void editorRef.current?.hoverDomNode?.(node.nodeId)
			} else if (!draggedNodeId) {
				recordHoverBridgeCall("clear")
				void editorRef.current?.clearHoveredDomNode?.()
			}
		},
		[draggedNodeId, editorRef, recordHoverBridgeCall],
	)
	const handleMouseLeave = useCallback(
		(node: DomTreeNode) => {
			setHoveredNodeId((current) => (current === node.nodeId ? null : current))
			recordHoverBridgeCall("clear")
			void editorRef.current?.clearHoveredDomNode?.()
		},
		[editorRef, recordHoverBridgeCall],
	)
	const rowHandlers: DOMTreeRowHandlers = {
		onDragOver: handleDragOver,
		onDragLeave: handleDragLeave,
		onDrop: (event, node) => void dropNode(event, node),
		onDragStart: handleDragStart,
		onDragEnd: resetDragState,
		onMouseEnter: handleMouseEnter,
		onMouseLeave: handleMouseLeave,
		onSelect: (node) => void selectNode(node),
		onShortcut: (event, node) => void handleNodeShortcut(event, node),
		onToggleExpanded: toggleExpanded,
		onRemove: (node) => void remove(node),
		onDuplicate: (node) => void duplicate(node),
		onCopy: (node) => void copyNode(node),
		onCut: (node) => void cutNode(node),
		onPaste: (node) => void pasteNode(node),
		onMoveToAdjacent: (node, direction) => void moveToAdjacent(node, direction),
		onAddText: (node, placement) => void addText(node, placement),
		onAddImage: (node, placement) => void addImage(node, placement),
		onOpenAddMenuChange: (key, open) => setOpenAddMenuKey(open ? key : null),
	}
	const renderNode = (node: DomTreeNode, depth = 0, renderChildren = true): React.ReactNode => (
		<DOMTreeRow
			key={node.nodeId}
			node={node}
			depth={depth}
			rootNodeId={tree?.root.nodeId}
			state={virtualRowRenderStateToken}
			handlers={rowHandlers}
			parentMap={parentMap}
			focusableNodeIds={focusableNodeIds}
			nodeButtonRefs={nodeButtonRefs}
			getNodeHint={getNodeHint}
			getNodeDisplayLabel={getNodeDisplayLabel}
		>
			{renderChildren && node.children.length > 0
				? node.children.map((child) => renderNode(child, depth + 1))
				: null}
		</DOMTreeRow>
	)
	if (!visible) return null
	const nodeCountBadge =
		tree && loadState === "ready" ? (
			<span className="shrink-0 rounded-md border border-border/80 bg-muted/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
				{t("stylePanel.domTree.nodeCount", { count: nodeMap.size })}
			</span>
		) : null
	const treeActions = (
		<>
			<ActionTooltip
				label={t(
					allNodesExpanded
						? "stylePanel.domTree.collapseAll"
						: "stylePanel.domTree.expandAll",
				)}
			>
				<Button
					data-testid="html-dom-tree-expand-toggle-button"
					size="icon"
					variant="ghost"
					className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					disabled={!tree || loadState !== "ready" || Boolean(draggedNodeId)}
					onClick={allNodesExpanded ? collapseAll : expandAll}
					aria-label={t(
						allNodesExpanded
							? "stylePanel.domTree.collapseAll"
							: "stylePanel.domTree.expandAll",
					)}
				>
					{allNodesExpanded ? (
						<ChevronsUpDown className="h-3.5 w-3.5" />
					) : (
						<ChevronsDownUp className="h-3.5 w-3.5" />
					)}
				</Button>
			</ActionTooltip>
			<ActionTooltip label={t("stylePanel.domTree.refresh")}>
				<Button
					data-testid="html-dom-tree-refresh-button"
					size="icon"
					variant="ghost"
					className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					disabled={loadState === "loading" || Boolean(draggedNodeId)}
					onClick={() => void refresh()}
					aria-label={t("stylePanel.domTree.refresh")}
				>
					<RefreshCw className="h-3.5 w-3.5" />
				</Button>
			</ActionTooltip>
		</>
	)
	return (
		<TooltipProvider delayDuration={200}>
			<div
				className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background/95"
				data-testid="html-dom-tree-panel"
				aria-label={t("stylePanel.domTree.title")}
				aria-busy={isBusy || loadState === "loading"}
			>
				<DomTreeChrome
					inSidebar={sidebarSlots !== null}
					structureChrome={sidebarSlots?.structureChrome ?? null}
					nodeCountBadge={nodeCountBadge}
					treeActions={treeActions}
				/>
				<div
					className="relative z-10 flex min-h-10 shrink-0 items-center border-b border-border/70 bg-background/95 px-3 py-1.5"
					data-testid="dom-tree-search-bar"
				>
					<Search className="pointer-events-none absolute left-5 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								setSearchQuery("")
								return
							}
							if (event.key !== "Enter" || searchResults.length === 0) return
							event.preventDefault()
							const direction = event.shiftKey ? -1 : 1
							const nextIndex =
								(activeSearchIndex + direction + searchResults.length) %
								searchResults.length
							focusSearchResult(searchResults[nextIndex], nextIndex)
						}}
						placeholder={t("stylePanel.domTree.searchPlaceholder")}
						aria-label={t("stylePanel.domTree.searchInputLabel")}
						aria-controls="dom-tree-search-results"
						aria-expanded={Boolean(normalizedSearchQuery)}
						aria-haspopup="listbox"
						aria-autocomplete="list"
						data-testid="dom-tree-search-input"
						className="h-7 min-w-0 flex-1 pl-8 pr-14 text-xs"
					/>
					{searchQuery ? (
						<>
							<span className="pointer-events-none absolute right-10 text-[10px] tabular-nums text-muted-foreground">
								{searchResults.length > 0
									? `${Math.min(activeSearchIndex + 1, searchResults.length)} / ${searchResults.length}`
									: t("stylePanel.domTree.searchNoResults")}
							</span>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="absolute right-4 h-6 w-6 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
								onClick={() => setSearchQuery("")}
								aria-label={t("stylePanel.domTree.clearSearch")}
								data-testid="dom-tree-search-clear"
							>
								<X className="h-3 w-3" />
							</Button>
						</>
					) : null}
					{normalizedSearchQuery ? (
						<div
							id="dom-tree-search-results"
							role="listbox"
							aria-label={t("stylePanel.domTree.searchResultsLabel")}
							className="absolute left-3 right-3 top-[calc(100%+4px)] max-h-64 overflow-y-auto rounded-lg border border-border/80 bg-popover p-1 shadow-xl"
							onWheel={(event) => event.stopPropagation()}
						>
							<div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
								{searchResults.length > 0
									? t("stylePanel.domTree.searchResultCount", {
											count: searchResults.length,
										})
									: t("stylePanel.domTree.searchNoResults")}
							</div>
							{visibleSearchResults.map((node, index) => (
								<button
									key={node.nodeId}
									type="button"
									role="option"
									aria-selected={index === activeSearchIndex}
									className={cn(
										"flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										index === activeSearchIndex && "bg-muted/70",
									)}
									onClick={() => focusSearchResult(node, index)}
									data-testid={`dom-tree-search-result-${node.nodeId}`}
								>
									<span className="shrink-0 rounded border border-border/70 bg-muted/50 px-1 py-0.5 text-[9px] text-muted-foreground">
										{getDomTreeSemanticLabel(t, getSemanticKey(node.tagName))}
									</span>
									<span className="min-w-0 flex-1 truncate font-medium text-foreground">
										{node.label}
									</span>
									{node.textContent ? (
										<span className="min-w-0 max-w-[45%] truncate text-muted-foreground">
											· {node.textContent}
										</span>
									) : null}
								</button>
							))}
							{searchResults.length > visibleSearchResults.length ? (
								<div className="px-2 py-1 text-[10px] text-muted-foreground">
									{t("stylePanel.domTree.searchMore", {
										count: searchResults.length - visibleSearchResults.length,
									})}
								</div>
							) : null}
						</div>
					) : null}
				</div>
				<div
					className={cn(
						"flex h-8 min-h-8 shrink-0 items-center gap-2 border-b px-3 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 ease-out motion-reduce:transition-none",
						draggedNodeId
							? invalidDropTargetId
								? "border-destructive/30 bg-destructive/10 text-destructive"
								: dropTarget
									? "border-primary/25 bg-primary/10 text-primary"
									: "border-border/70 bg-muted/15 text-muted-foreground"
							: "border-border/70 bg-muted/10 text-muted-foreground",
					)}
					role="status"
					aria-live="polite"
					data-drag-active={draggedNodeId ? "true" : undefined}
				>
					<span
						className={cn(
							"flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted-foreground/10 text-muted-foreground transition-[background-color,color,transform] duration-150 motion-reduce:transition-none",
							draggedNodeId &&
								(invalidDropTargetId
									? "bg-destructive/15 text-destructive"
									: dropTarget
										? "bg-primary/15 text-primary"
										: "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/20"),
						)}
					>
						{dragStatusIcon}
					</span>
					<span className="min-w-0 truncate">{getDragStatus()}</span>
				</div>
				<ScrollArea
					type="always"
					className="min-h-0 min-w-0 flex-1 overflow-hidden [&_[data-orientation=horizontal]]:hidden [&_[data-slot='scroll-area-viewport']>div]:!block [&_[data-slot='scroll-area-viewport']>div]:!w-full [&_[data-slot='scroll-area-viewport']>div]:!min-w-0"
					viewportRef={treeViewportRef}
					viewportClassName="h-full min-h-0 min-w-0 overflow-x-hidden bg-muted/10 pr-4"
					viewportStyle={{ overflowX: "hidden", overflowY: "auto" }}
					onWheel={(event) => event.stopPropagation()}
				>
					{actionError ? (
						<div
							data-testid="html-dom-tree-action-error"
							className="mx-2 mt-2 border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
							role="alert"
						>
							{actionError}
						</div>
					) : null}
					{tree && loadState === "ready" ? (
						shouldVirtualize ? (
							<DOMTreeVirtualList
								label={t("stylePanel.domTree.title")}
								visibleRows={visibleRows}
								nodeMap={nodeMap}
								virtualItems={virtualItemsForRender}
								totalSize={treeVirtualizer.getTotalSize()}
								isScrolling={treeVirtualizer.isScrolling}
								renderNode={renderNode}
								renderStateToken={virtualRowRenderStateToken}
							/>
						) : (
							<div
								className="w-full min-w-0 max-w-full overflow-hidden px-1.5 py-1.5"
								role="tree"
								aria-label={t("stylePanel.domTree.title")}
							>
								{renderNode(tree.root)}
							</div>
						)
					) : loadState === "error" ? (
						<div
							className="flex flex-col gap-2 p-3 text-xs text-muted-foreground"
							data-testid="html-dom-tree-load-error"
						>
							<span>{t("stylePanel.domTree.loadFailed")}</span>
							<Button
								data-testid="html-dom-tree-retry-button"
								size="sm"
								variant="outline"
								onClick={() => void refresh()}
							>
								{t("stylePanel.domTree.retry")}
							</Button>
						</div>
					) : (
						<div
							className="p-3 text-xs text-muted-foreground"
							data-testid="html-dom-tree-loading"
						>
							{t("stylePanel.domTree.loading")}
						</div>
					)}
				</ScrollArea>
				<Dialog
					open={textInsertRequest !== null}
					onOpenChange={(open) => {
						if (!open) setTextInsertRequest(null)
					}}
				>
					<DialogContent
						className="max-w-md gap-5 rounded-xl border-border/80 p-5 shadow-2xl"
						data-testid="html-dom-tree-add-text-dialog"
					>
						<DialogHeader className="gap-1.5 text-left">
							<DialogTitle>{t("stylePanel.domTree.addTextDialog.title")}</DialogTitle>
							<DialogDescription>
								{t("stylePanel.domTree.addTextDialog.description", {
									node: textInsertRequest?.targetLabel ?? "",
									placement: textInsertRequest
										? getTextInsertPlacementLabel(
												t,
												textInsertRequest.placement,
											)
										: "",
								})}
							</DialogDescription>
						</DialogHeader>
						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault()
								void submitTextInsert()
							}}
						>
							<Input
								data-testid="html-dom-tree-add-text-input"
								autoFocus
								value={textInput}
								onChange={(event) => setTextInput(event.target.value)}
								placeholder={t("stylePanel.domTree.addTextDialog.placeholder")}
								maxLength={500}
								aria-label={t("stylePanel.domTree.addTextDialog.inputLabel")}
							/>
							<DialogFooter>
								<Button
									data-testid="html-dom-tree-add-text-cancel-button"
									type="button"
									variant="outline"
									onClick={() => setTextInsertRequest(null)}
								>
									{t("stylePanel.domTree.addTextDialog.cancel")}
								</Button>
								<Button
									data-testid="html-dom-tree-add-text-confirm-button"
									type="submit"
									disabled={!textInput.trim() || isBusy}
								>
									{t("stylePanel.domTree.addTextDialog.confirm")}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
				<Dialog
					open={deleteRequest !== null}
					onOpenChange={(open) => {
						if (!open) setDeleteRequest(null)
					}}
				>
					<DialogContent
						className="max-w-md gap-5 rounded-xl border-border/80 p-5 shadow-2xl"
						data-testid="html-dom-tree-delete-dialog"
					>
						<DialogHeader className="gap-1.5 text-left">
							<DialogTitle>{t("stylePanel.domTree.deleteDialog.title")}</DialogTitle>
							<DialogDescription>
								{t("stylePanel.domTree.deleteDialog.description", {
									node: deleteRequest?.targetLabel ?? "",
								})}
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								data-testid="html-dom-tree-delete-cancel-button"
								type="button"
								variant="outline"
								onClick={() => setDeleteRequest(null)}
							>
								{t("stylePanel.domTree.deleteDialog.cancel")}
							</Button>
							<Button
								data-testid="html-dom-tree-delete-confirm-button"
								type="button"
								variant="destructive"
								disabled={isBusy || !deleteRequest}
								onClick={() => {
									if (deleteRequest) void deleteNode(deleteRequest)
								}}
							>
								{t("stylePanel.domTree.deleteDialog.confirm")}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	)
}

function DomTreeChrome({
	inSidebar,
	structureChrome,
	nodeCountBadge,
	treeActions,
}: {
	inSidebar: boolean
	structureChrome: HTMLElement | null
	nodeCountBadge: React.ReactNode
	treeActions: React.ReactNode
}) {
	if (inSidebar) {
		return structureChrome
			? createPortal(
					<>
						{nodeCountBadge}
						{treeActions}
					</>,
					structureChrome,
				)
			: null
	}
	return (
		<div
			className="flex h-9 shrink-0 items-center justify-end gap-1 border-b border-border/80 bg-card/95 px-2"
			data-testid="html-dom-tree-local-chrome"
		>
			{nodeCountBadge}
			{treeActions}
		</div>
	)
}

// Zoom state is owned by the renderer above this panel. Keep the recursive tree
// out of that high-frequency render path when its own inputs are unchanged.
export const DOMTreePanel = React.memo(DOMTreePanelInner)
DOMTreePanel.displayName = "DOMTreePanel"
