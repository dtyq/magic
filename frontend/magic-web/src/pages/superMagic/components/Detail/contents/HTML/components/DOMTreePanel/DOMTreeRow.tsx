import * as React from "react"
import { createPortal } from "react-dom"
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Ban,
	ChevronRight,
	CornerDownRight,
	GripVertical,
	Image as ImageIcon,
	Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ContextMenu, ContextMenuTrigger } from "@/components/shadcn-ui/context-menu"
import { cn } from "@/utils/cn"
import { TAILWIND_Z_INDEX_CLASSES } from "../../constants/z-index"
import type { DomTreeNode } from "../../iframe-bridge/types/messages"
import { DOMTreeContextMenu } from "./DOMTreeContextMenu"
import { ActionTooltip, AddNodeMenu, NodeDetailsPopover } from "./DOMTreeRowControls"
import {
	DOM_TREE_INDENT_STEP,
	getDomTreeSemanticLabel,
	getSemanticKey,
	getSemanticTone,
	isSelectableNode,
	type DropPosition,
	type InsertPlacement,
} from "./domTreeModel"

export interface DOMTreeRowState {
	expanded: Set<string>
	selectedNodeId: string | null
	hoveredNodeId: string | null
	draggedNodeId: string | null
	dropTarget: { nodeId: string; position: DropPosition } | null
	invalidDropTargetId: string | null
	isBusy: boolean
	openAddMenuKey: string | null
	clipboardNodeId: string | null
}

export interface DOMTreeRowHandlers {
	onDragOver: (event: React.DragEvent<HTMLDivElement>, node: DomTreeNode) => void
	onDragLeave: (event: React.DragEvent<HTMLDivElement>, node: DomTreeNode) => void
	onDrop: (event: React.DragEvent<HTMLDivElement>, node: DomTreeNode) => void
	onDragStart: (
		event: React.DragEvent<HTMLSpanElement>,
		node: DomTreeNode,
		semanticLabel: string,
	) => void
	onDragEnd: () => void
	onMouseEnter: (node: DomTreeNode) => void
	onMouseLeave: (node: DomTreeNode) => void
	onSelect: (node: DomTreeNode) => void
	onShortcut: (event: React.KeyboardEvent<HTMLButtonElement>, node: DomTreeNode) => void
	onToggleExpanded: (nodeId: string) => void
	onRemove: (node: DomTreeNode) => void
	onDuplicate: (node: DomTreeNode) => void
	onCopy: (node: DomTreeNode) => void
	onCut: (node: DomTreeNode) => void
	onPaste: (node: DomTreeNode) => void
	onMoveToAdjacent: (node: DomTreeNode, direction: -1 | 1) => void
	onAddText: (node: DomTreeNode, placement: InsertPlacement) => void
	onAddImage: (node: DomTreeNode, placement: InsertPlacement) => void
	onOpenAddMenuChange: (key: string, open: boolean) => void
}

interface Props {
	node: DomTreeNode
	depth: number
	rootNodeId?: string
	state: DOMTreeRowState
	handlers: DOMTreeRowHandlers
	parentMap: Map<string, DomTreeNode>
	focusableNodeIds: string[]
	nodeButtonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>
	getNodeHint: (node: DomTreeNode) => string
	getNodeDisplayLabel: (node: DomTreeNode) => string
	children?: React.ReactNode
}

const THUMBNAIL_PREVIEW_SIZE = 250
const THUMBNAIL_PREVIEW_FRAME = 10
const THUMBNAIL_PREVIEW_GAP = 8
const THUMBNAIL_PREVIEW_VIEWPORT_PADDING = 8

type ThumbnailPreviewSide = "top" | "bottom" | "right" | "left"

interface ThumbnailPreviewPosition {
	top: number
	left: number
	side: ThumbnailPreviewSide
}

interface ThumbnailPreviewSize {
	width: number
	height: number
}

const DEFAULT_THUMBNAIL_PREVIEW_SIZE: ThumbnailPreviewSize = {
	width: THUMBNAIL_PREVIEW_SIZE,
	height: THUMBNAIL_PREVIEW_SIZE,
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), Math.max(min, max))
}

function getBoundedThumbnailPreviewSize(image: HTMLImageElement): ThumbnailPreviewSize | null {
	if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return null
	const scale = Math.min(
		1,
		THUMBNAIL_PREVIEW_SIZE / image.naturalWidth,
		THUMBNAIL_PREVIEW_SIZE / image.naturalHeight,
	)
	return {
		width: Math.round(image.naturalWidth * scale),
		height: Math.round(image.naturalHeight * scale),
	}
}

export function getThumbnailPreviewPosition(
	rect: Pick<DOMRect, "top" | "left" | "right" | "bottom" | "width" | "height">,
	preview: ThumbnailPreviewSize = DEFAULT_THUMBNAIL_PREVIEW_SIZE,
	viewport = { width: window.innerWidth, height: window.innerHeight },
): ThumbnailPreviewPosition {
	const previewWidth = Math.min(
		preview.width + THUMBNAIL_PREVIEW_FRAME,
		Math.max(1, viewport.width - THUMBNAIL_PREVIEW_VIEWPORT_PADDING * 2),
	)
	const previewHeight = Math.min(
		preview.height + THUMBNAIL_PREVIEW_FRAME,
		Math.max(1, viewport.height - THUMBNAIL_PREVIEW_VIEWPORT_PADDING * 2),
	)
	const centeredLeft = rect.left + rect.width / 2
	const centeredTop = rect.top + rect.height / 2
	const availableTop = rect.top - THUMBNAIL_PREVIEW_GAP
	const availableBottom = viewport.height - rect.bottom - THUMBNAIL_PREVIEW_GAP
	const availableRight = viewport.width - rect.right - THUMBNAIL_PREVIEW_GAP
	const availableLeft = rect.left - THUMBNAIL_PREVIEW_GAP

	if (availableTop >= previewHeight) {
		return {
			top: clamp(
				rect.top - THUMBNAIL_PREVIEW_GAP - previewHeight,
				THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
				viewport.height - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewHeight,
			),
			left: clamp(
				centeredLeft - previewWidth / 2,
				THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
				viewport.width - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewWidth,
			),
			side: "top",
		}
	}

	if (availableBottom >= previewHeight) {
		return {
			top: clamp(
				rect.bottom + THUMBNAIL_PREVIEW_GAP,
				THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
				viewport.height - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewHeight,
			),
			left: clamp(
				centeredLeft - previewWidth / 2,
				THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
				viewport.width - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewWidth,
			),
			side: "bottom",
		}
	}

	const side = availableRight >= availableLeft ? "right" : "left"
	return {
		top: clamp(
			centeredTop - previewHeight / 2,
			THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
			viewport.height - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewHeight,
		),
		left:
			side === "right"
				? clamp(
						rect.right + THUMBNAIL_PREVIEW_GAP,
						THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
						viewport.width - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewWidth,
					)
				: clamp(
						rect.left - THUMBNAIL_PREVIEW_GAP - previewWidth,
						THUMBNAIL_PREVIEW_VIEWPORT_PADDING,
						viewport.width - THUMBNAIL_PREVIEW_VIEWPORT_PADDING - previewWidth,
					),
		side,
	}
}

function NodeThumbnail({ nodeId, src }: { nodeId: string; src: string }) {
	const [failed, setFailed] = React.useState(false)
	const [open, setOpen] = React.useState(false)
	const [previewSize, setPreviewSize] = React.useState<ThumbnailPreviewSize | null>(null)
	const [position, setPosition] = React.useState<ThumbnailPreviewPosition | null>(null)
	const triggerRef = React.useRef<HTMLSpanElement>(null)

	React.useEffect(() => {
		setFailed(false)
		setOpen(false)
		setPreviewSize(null)
		setPosition(null)
	}, [src])

	const updatePosition = React.useCallback(
		(nextPreviewSize = previewSize ?? DEFAULT_THUMBNAIL_PREVIEW_SIZE) => {
			const trigger = triggerRef.current
			if (!trigger) return
			setPosition(
				getThumbnailPreviewPosition(trigger.getBoundingClientRect(), nextPreviewSize),
			)
		},
		[previewSize],
	)

	const handleImageLoad = React.useCallback(
		(event: React.SyntheticEvent<HTMLImageElement>) => {
			const nextPreviewSize = getBoundedThumbnailPreviewSize(event.currentTarget)
			if (!nextPreviewSize) return
			setPreviewSize(nextPreviewSize)
			if (open) updatePosition(nextPreviewSize)
		},
		[open, updatePosition],
	)

	const showPreview = React.useCallback(() => {
		updatePosition()
		setOpen(true)
	}, [updatePosition])

	React.useEffect(() => {
		if (!open) return
		const handleViewportChange = () => updatePosition()
		window.addEventListener("resize", handleViewportChange)
		document.addEventListener("scroll", handleViewportChange, true)
		return () => {
			window.removeEventListener("resize", handleViewportChange)
			document.removeEventListener("scroll", handleViewportChange, true)
		}
	}, [open, updatePosition])

	if (failed) return null

	return (
		<>
			<span
				ref={triggerRef}
				className="inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-sm bg-muted/40 outline outline-1 outline-black/10 dark:outline-white/10"
				data-testid={`dom-tree-thumbnail-${nodeId}`}
				aria-hidden="true"
				onMouseEnter={showPreview}
				onPointerMove={showPreview}
				onMouseLeave={() => setOpen(false)}
			>
				<img
					src={src}
					alt=""
					loading="lazy"
					draggable={false}
					className="h-full w-full object-cover"
					onLoad={handleImageLoad}
					onError={() => setFailed(true)}
				/>
			</span>
			{open && position
				? createPortal(
						<div
							role="tooltip"
							data-testid={`dom-tree-thumbnail-preview-${nodeId}`}
							data-preview-side={position.side}
							className={`pointer-events-none fixed ${TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP} rounded-md border border-white/15 bg-black/90 p-1 shadow-lg`}
							style={{ top: position.top, left: position.left }}
						>
							<img
								src={src}
								alt={nodeId}
								loading="lazy"
								draggable={false}
								className="block max-h-[250px] max-w-[250px] object-contain"
								onLoad={handleImageLoad}
								onError={() => setOpen(false)}
							/>
						</div>,
						document.body,
					)
				: null}
		</>
	)
}

export function DOMTreeRow({
	node,
	depth,
	rootNodeId,
	state,
	handlers,
	parentMap,
	focusableNodeIds,
	nodeButtonRefs,
	getNodeHint,
	getNodeDisplayLabel,
	children,
}: Props) {
	const { t } = useTranslation("super")
	const isExpanded = state.expanded.has(node.nodeId)
	const semanticKey = getSemanticKey(node.tagName)
	const semanticLabel = getDomTreeSemanticLabel(t, semanticKey)
	const isRootNode = rootNodeId === node.nodeId || node.tagName.toLowerCase() === "body"
	const canInsertInside = node.canHaveChildren && (node.editable || isRootNode)
	const canInsertSibling = parentMap.has(node.nodeId) && node.editable
	const isDragged = state.draggedNodeId === node.nodeId
	const activeDropPosition =
		state.dropTarget?.nodeId === node.nodeId ? state.dropTarget.position : null
	const isInvalidDropTarget = state.invalidDropTargetId === node.nodeId

	const handleNodeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		if (
			(event.metaKey || event.ctrlKey) &&
			!event.shiftKey &&
			!event.altKey &&
			["c", "x", "v"].includes(event.key.toLowerCase())
		) {
			event.preventDefault()
			handlers.onShortcut(event, node)
			return
		}
		if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
			event.preventDefault()
			const currentIndex = focusableNodeIds.indexOf(node.nodeId)
			const nextIndex =
				event.key === "Home"
					? 0
					: event.key === "End"
						? focusableNodeIds.length - 1
						: currentIndex + (event.key === "ArrowDown" ? 1 : -1)
			const nextNodeId = focusableNodeIds[nextIndex]
			if (nextNodeId) nodeButtonRefs.current.get(nextNodeId)?.focus()
			return
		}
		if (event.key === "ArrowRight" && node.children.length > 0) {
			event.preventDefault()
			if (!isExpanded) handlers.onToggleExpanded(node.nodeId)
			return
		}
		if (event.key === "ArrowLeft" && node.children.length > 0) {
			event.preventDefault()
			if (isExpanded) handlers.onToggleExpanded(node.nodeId)
			return
		}
		if ((event.key === "Delete" || event.key === "Backspace") && node.canDelete) {
			event.preventDefault()
			handlers.onRemove(node)
			return
		}
		if (
			(event.metaKey || event.ctrlKey) &&
			event.key.toLowerCase() === "d" &&
			node.editable &&
			node.selector
		) {
			event.preventDefault()
			handlers.onDuplicate(node)
		}
	}

	return (
		<div className="relative w-full min-w-0 max-w-full">
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						onDragOver={(event) => handlers.onDragOver(event, node)}
						onDragEnter={(event) => handlers.onDragOver(event, node)}
						onDragLeave={(event) => handlers.onDragLeave(event, node)}
						onDragEnd={handlers.onDragEnd}
						onDrop={(event) => handlers.onDrop(event, node)}
						className={cn(
							"group relative box-border grid h-8 max-h-8 min-h-8 w-full min-w-0 max-w-full select-none grid-cols-[20px_20px_minmax(0,1fr)] items-center gap-1 overflow-hidden whitespace-nowrap rounded-none border border-transparent bg-card/45 px-1.5 pr-1 text-[11px] leading-none shadow-[inset_0_-1px_0_hsl(var(--border)/0.14)] transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-out motion-reduce:transition-none",
							node.canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default",
							"focus-within:border-border focus-within:bg-muted/75 hover:border-border/60 hover:bg-muted/55",
							state.hoveredNodeId === node.nodeId &&
								state.selectedNodeId !== node.nodeId &&
								"border-primary/35 bg-accent/60 text-foreground shadow-[inset_3px_0_0_hsl(var(--primary)/0.85)]",
							state.selectedNodeId === node.nodeId &&
								"border-sky-400/70 bg-sky-50/80 text-foreground shadow-[inset_2px_0_0_rgb(14_165_233),inset_0_0_0_1px_rgb(14_165_233_/_0.18)] dark:border-sky-500/60 dark:bg-sky-950/25",
							isDragged &&
								"z-20 cursor-grabbing border-dashed border-primary/80 bg-primary/20 opacity-60 ring-2 ring-inset ring-primary/65",
							state.isBusy && "cursor-wait",
							state.draggedNodeId &&
								!isDragged &&
								!activeDropPosition &&
								"opacity-85",
							!node.editable && !node.canHaveChildren && "opacity-50",
							activeDropPosition === "inside" &&
								"z-10 border-primary/70 bg-primary/15 ring-2 ring-inset ring-primary/75",
							isInvalidDropTarget &&
								"z-10 border-destructive/65 bg-destructive/10 text-destructive ring-2 ring-inset ring-destructive/70",
						)}
						style={{ paddingLeft: depth * DOM_TREE_INDENT_STEP + 3 }}
						data-node-id={node.nodeId}
						data-testid={`dom-tree-node-${node.nodeId}`}
						role="treeitem"
						aria-level={depth + 1}
						aria-expanded={node.children.length > 0 ? isExpanded : undefined}
						data-dragging={isDragged ? "true" : undefined}
						data-drop-position={activeDropPosition ?? undefined}
						data-drop-invalid={isInvalidDropTarget ? "true" : undefined}
						data-state={
							isDragged
								? "dragging"
								: isInvalidDropTarget
									? "drop-invalid"
									: activeDropPosition
										? `drop-${activeDropPosition}`
										: state.selectedNodeId === node.nodeId
											? "selected"
											: state.hoveredNodeId === node.nodeId
												? "hovered"
												: "idle"
						}
						aria-selected={state.selectedNodeId === node.nodeId}
						aria-grabbed={isDragged}
						onClick={(event) => {
							if (event.target === event.currentTarget) handlers.onSelect(node)
						}}
						onMouseEnter={() => handlers.onMouseEnter(node)}
						onMouseLeave={() => handlers.onMouseLeave(node)}
					>
						{activeDropPosition === "before" ? (
							<span className="pointer-events-none absolute inset-x-2 top-0 z-10 flex h-0.5 items-center justify-end bg-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]">
								<span className="absolute right-0 top-0 flex items-center gap-1 border border-primary/40 bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground shadow-md">
									<ArrowUp className="h-2.5 w-2.5" />
									{t("stylePanel.domTree.dropBeforeShort")}
								</span>
							</span>
						) : null}
						{activeDropPosition === "after" ? (
							<span className="pointer-events-none absolute inset-x-2 bottom-0 z-10 flex h-0.5 items-center justify-end bg-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]">
								<span className="absolute bottom-0 right-0 flex items-center gap-1 border border-primary/40 bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground shadow-md">
									<ArrowDown className="h-2.5 w-2.5" />
									{t("stylePanel.domTree.dropAfterShort")}
								</span>
							</span>
						) : null}
						{activeDropPosition === "inside" ? (
							<span className="pointer-events-none absolute inset-0.5 z-10 flex items-center justify-end border-2 border-dashed border-primary/70 bg-primary/10 px-2 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]">
								<span className="flex items-center gap-1 border border-primary/40 bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground shadow-md">
									<CornerDownRight className="h-2.5 w-2.5" />
									{t("stylePanel.domTree.dropInsideShort")}
								</span>
							</span>
						) : null}
						{isInvalidDropTarget ? (
							<span className="pointer-events-none absolute inset-x-1 inset-y-0.5 z-10 flex min-w-0 items-center justify-center gap-1 rounded-none border border-destructive/45 bg-destructive/15 px-2 text-[9px] font-semibold text-destructive shadow-sm backdrop-blur-sm">
								<Ban className="h-2.5 w-2.5 shrink-0" />
								<span className="truncate">
									{t("stylePanel.domTree.dropInvalid", {
										node: getNodeDisplayLabel(node),
									})}
								</span>
							</span>
						) : null}
						{node.children.length > 0 ? (
							<ActionTooltip
								label={
									isExpanded
										? t("stylePanel.domTree.collapseNode")
										: t("stylePanel.domTree.expand")
								}
							>
								<button
									type="button"
									className="z-10 flex h-full w-5 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-background hover:text-foreground active:scale-[0.96]"
									onClick={() => handlers.onToggleExpanded(node.nodeId)}
									aria-label={
										isExpanded
											? t("stylePanel.domTree.collapseNode")
											: t("stylePanel.domTree.expand")
									}
									data-testid={`dom-tree-toggle-${node.nodeId}`}
								>
									<span
										className={cn(
											"inline-flex transition-transform duration-200",
											isExpanded && "rotate-90",
										)}
									>
										<ChevronRight className="h-3.5 w-3.5" />
									</span>
								</button>
							</ActionTooltip>
						) : (
							<span className="h-full w-5 shrink-0" aria-hidden="true" />
						)}
						<span
							className={cn(
								"flex h-full w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/45 transition-[background-color,color,transform] duration-150",
								node.canMove &&
									"cursor-grab hover:scale-105 hover:bg-muted/80 hover:text-foreground active:scale-[0.96] active:cursor-grabbing",
							)}
							draggable={node.canMove}
							onDragStart={(event) =>
								handlers.onDragStart(event, node, semanticLabel)
							}
							aria-label={
								node.canMove ? t("stylePanel.domTree.dragHandle") : undefined
							}
							aria-hidden={node.canMove ? undefined : true}
							data-testid={`dom-tree-drag-handle-${node.nodeId}`}
						>
							<GripVertical className="h-3.5 w-3.5" />
						</span>
						<button
							type="button"
							disabled={state.isBusy || !isSelectableNode(node)}
							ref={(element) => {
								if (element) nodeButtonRefs.current.set(node.nodeId, element)
								else nodeButtonRefs.current.delete(node.nodeId)
							}}
							className="col-start-3 flex h-full min-h-0 min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-none text-left leading-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
							onClick={() => handlers.onSelect(node)}
							onKeyDown={handleNodeKeyDown}
							data-testid={`dom-tree-node-content-${node.nodeId}`}
						>
							<NodeDetailsPopover
								content={
									<div className="flex max-w-72 flex-col gap-1">
										<span className="font-mono text-xs font-semibold text-background">
											{node.label}
										</span>
										{node.textContent ? (
											<span className="max-w-72 whitespace-normal break-words text-[11px] text-background/80">
												{node.textContent}
											</span>
										) : null}
										{getNodeHint(node) ? (
											<span className="max-w-72 whitespace-normal break-words text-[10px] leading-4 text-background/70">
												{getNodeHint(node)}
											</span>
										) : null}
									</div>
								}
							>
								<span
									className={cn(
										"inline-flex h-5 min-h-5 min-w-0 max-w-full shrink-0 items-center truncate rounded-sm border px-1.5 text-[10px] font-medium leading-4",
										getSemanticTone(semanticKey),
									)}
									data-testid={`dom-tree-node-tag-${node.nodeId}`}
								>
									<span className="truncate">{semanticLabel}</span>
								</span>
							</NodeDetailsPopover>
							{node.thumbnailUrl ? (
								<NodeThumbnail nodeId={node.nodeId} src={node.thumbnailUrl} />
							) : null}
							{node.dynamicWarning ? (
								<ActionTooltip label={getNodeHint(node)}>
									<span
										className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-amber-600 dark:text-amber-400"
										aria-label={getNodeHint(node)}
									>
										<AlertTriangle className="h-3 w-3" />
									</span>
								</ActionTooltip>
							) : null}
							{node.textContent ? (
								<span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
									· {node.textContent}
								</span>
							) : null}
							{node.tagName.toLowerCase() === "img" && node.resource ? (
								<span className="flex min-w-0 max-w-[42%] flex-1 items-center gap-1 overflow-hidden text-[10px] text-muted-foreground/75">
									<ImageIcon className="h-3 w-3 shrink-0" />
									<span className="min-w-0 flex-1 truncate">{node.resource}</span>
								</span>
							) : null}
						</button>
						<span
							className={cn(
								"pointer-events-none absolute inset-y-1 right-1 z-20 flex h-auto w-max min-w-0 max-w-[calc(100%_-_8px)] translate-x-1 items-center justify-end gap-1 overflow-hidden rounded-md border border-border/70 bg-background/95 px-1 opacity-0 shadow-sm transition-[opacity,transform,background-color] duration-150 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100",
								state.selectedNodeId === node.nodeId &&
									"bg-sky-50/95 dark:bg-sky-950/95",
								state.isBusy && "pointer-events-none",
								state.draggedNodeId && "pointer-events-none opacity-0",
							)}
							aria-hidden={
								node.editable || canInsertInside || canInsertSibling
									? undefined
									: true
							}
							data-testid={`dom-tree-actions-${node.nodeId}`}
						>
							{node.editable || canInsertInside || canInsertSibling ? (
								<>
									{parentMap.has(node.nodeId) ? (
										<>
											<ActionTooltip label={t("stylePanel.domTree.moveUp")}>
												<Button
													size="icon"
													variant="ghost"
													className="h-5 w-5 rounded-sm"
													disabled={
														state.isBusy ||
														parentMap.get(node.nodeId)?.children[0]
															?.nodeId === node.nodeId
													}
													onClick={() =>
														handlers.onMoveToAdjacent(node, -1)
													}
													aria-label={t("stylePanel.domTree.moveUp")}
													data-testid="dom-tree-move-up-button"
													data-node-id={node.nodeId}
												>
													<ArrowUp className="h-3 w-3" />
												</Button>
											</ActionTooltip>
											<ActionTooltip label={t("stylePanel.domTree.moveDown")}>
												<Button
													size="icon"
													variant="ghost"
													className="h-5 w-5 rounded-sm"
													disabled={
														state.isBusy ||
														parentMap.get(node.nodeId)?.children.at(-1)
															?.nodeId === node.nodeId
													}
													onClick={() =>
														handlers.onMoveToAdjacent(node, 1)
													}
													aria-label={t("stylePanel.domTree.moveDown")}
													data-testid="dom-tree-move-down-button"
													data-node-id={node.nodeId}
												>
													<ArrowDown className="h-3 w-3" />
												</Button>
											</ActionTooltip>
										</>
									) : null}
									{canInsertInside ? (
										<AddNodeMenu
											mode="inside"
											open={state.openAddMenuKey === `${node.nodeId}:inside`}
											onOpenChange={(open) =>
												handlers.onOpenAddMenuChange(
													`${node.nodeId}:inside`,
													open,
												)
											}
											onAddText={(placement) =>
												handlers.onAddText(node, placement)
											}
											onAddImage={(placement) =>
												handlers.onAddImage(node, placement)
											}
											label={t("stylePanel.domTree.addInsideAction")}
											testIdPrefix="dom-tree-add"
											nodeId={node.nodeId}
											disabled={state.isBusy}
										/>
									) : null}
									{canInsertSibling ? (
										<AddNodeMenu
											mode="sibling"
											open={state.openAddMenuKey === `${node.nodeId}:sibling`}
											onOpenChange={(open) =>
												handlers.onOpenAddMenuChange(
													`${node.nodeId}:sibling`,
													open,
												)
											}
											onAddText={(placement) =>
												handlers.onAddText(node, placement)
											}
											onAddImage={(placement) =>
												handlers.onAddImage(node, placement)
											}
											label={t("stylePanel.domTree.addSiblingAction")}
											testIdPrefix="dom-tree-add-sibling"
											nodeId={node.nodeId}
											disabled={state.isBusy}
										/>
									) : null}
									{node.canDelete ? (
										<ActionTooltip label={t("stylePanel.domTree.delete")}>
											<Button
												size="icon"
												variant="ghost"
												className="h-5 w-5 rounded-sm text-destructive"
												disabled={state.isBusy}
												onClick={() => handlers.onRemove(node)}
												aria-label={t("stylePanel.domTree.delete")}
												data-testid="dom-tree-delete-button"
												data-node-id={node.nodeId}
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</ActionTooltip>
									) : null}
								</>
							) : null}
						</span>
					</div>
				</ContextMenuTrigger>
				<DOMTreeContextMenu
					node={node}
					semanticLabel={semanticLabel}
					nodeHint={getNodeHint(node)}
					isExpanded={isExpanded}
					isBusy={state.isBusy}
					canInsertInside={canInsertInside}
					canInsertSibling={canInsertSibling}
					canMoveBefore={
						node.canMove &&
						parentMap.get(node.nodeId)?.children[0]?.nodeId !== node.nodeId
					}
					canMoveAfter={
						node.canMove &&
						parentMap.get(node.nodeId)?.children.at(-1)?.nodeId !== node.nodeId
					}
					onSelect={() => handlers.onSelect(node)}
					onCopy={() => handlers.onCopy(node)}
					onCut={() => handlers.onCut(node)}
					onPaste={() => handlers.onPaste(node)}
					onDuplicate={() => handlers.onDuplicate(node)}
					onToggleExpanded={() => handlers.onToggleExpanded(node.nodeId)}
					onMoveBefore={() => handlers.onMoveToAdjacent(node, -1)}
					onMoveAfter={() => handlers.onMoveToAdjacent(node, 1)}
					onAddText={(placement) => handlers.onAddText(node, placement)}
					onAddImage={(placement) => handlers.onAddImage(node, placement)}
					onDelete={() => handlers.onRemove(node)}
					canPaste={Boolean(state.clipboardNodeId)}
				/>
			</ContextMenu>
			{children ? (
				<div
					data-testid={`dom-tree-children-${node.nodeId}`}
					role="group"
					aria-hidden={!isExpanded}
					data-inert={!isExpanded ? "true" : undefined}
					ref={(element) => {
						if (!element) return
						const inertElement = element as HTMLDivElement & { inert?: boolean }
						if ("inert" in inertElement) inertElement.inert = !isExpanded
						else if (!isExpanded) inertElement.setAttribute("inert", "")
						else inertElement.removeAttribute("inert")
					}}
					className={cn(
						"grid transition-[grid-template-rows,opacity,filter] duration-200 ease-out",
						isExpanded
							? "grid-rows-[1fr] opacity-100 blur-0"
							: "pointer-events-none grid-rows-[0fr] opacity-0 blur-[2px]",
					)}
				>
					<div className="min-h-0 overflow-hidden">{children}</div>
				</div>
			) : null}
		</div>
	)
}

DOMTreeRow.displayName = "DOMTreeRow"
