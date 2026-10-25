import { useCallback, useMemo, useState, useEffect } from "react"
import styles from "./index.module.css"
import IconButton from "../../primitives/custom/IconButton/index"
import {
	Eye,
	EyeClosed,
	Film,
	Folder,
	LockKeyhole,
	LockOpen,
	Minimize2 as MinimizeIcon,
	Search,
	SquareCheckBig,
	Type,
	Workflow,
	X,
} from "lucide-react"
import { FolderIcon } from "../../primitives/icons/index"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Input } from "../../primitives/shadcn/input"
import { Checkbox } from "../../primitives/shadcn/checkbox"
import LayersEmpty from "../empty/index"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../primitives/shadcn/tooltip"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { cn } from "../../../runtime/shared/lib/utils"
import Tree, { type TreeNode, type RenderNodeContext } from "../../primitives/custom/Tree/index"
import {
	ElementTypeEnum,
	type AudioElement,
	type RectangleElement,
	type EllipseElement,
	type TriangleElement,
	type StarElement,
	type ImageElement,
	type ImageElementContent,
	type VideoElement,
} from "../../../runtime/document/types"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasData, useCanvasEvent } from "../../../app/hooks/canvas"
import type { CanvasEvent } from "../../../runtime/core/EventEmitter"
import { useCanvasUI } from "../../../app/providers/CanvasUIProvider"
import { useLayersUI } from "../../../app/providers/LayersUIProvider"
import { useElementMenu } from "../../panels/menu/ElementMenuContext"
import { useMagic } from "../../../app/providers/MagicProvider"
import type { CanvasDesignStorageData, CanvasLayersFilterState } from "../../../public/magic-types"
import { RectanglePreview } from "../previews/RectanglePreview"
import { EllipsePreview } from "../previews/EllipsePreview"
import { TrianglePreview } from "../previews/TrianglePreview"
import { StarPreview } from "../previews/StarPreview"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { LayerTreeData } from "../types"
import { convertLayerToTreeNode } from "../layerTreeAdapter"
import LayerMediaPreview from "../previews/LayerMediaPreview"
import {
	DEFAULT_LAYERS_FILTER,
	collectExpandableNodeIds,
	filterLayerTreeData,
	hasActiveLayersFilter,
	normalizeLayersFilter,
} from "../layerFilters"
import LayersFilterPopover from "./LayersFilterPopover"
import { createLayerRefreshScheduler } from "./layerRefreshScheduler"
import LayerBatchToolbar from "./LayerBatchToolbar"
import {
	areAllLayersChecked,
	areSomeLayersChecked,
	collectAllLayerIds,
	getLayerCheckState,
	toggleLayerTreeSelection,
} from "../layerSelection"

const LAYER_TREE_VIRTUAL_THRESHOLD = 80
const LAYER_TREE_ROW_HEIGHT = 34

function normalizeLayerSearchKeyword(value: string) {
	return value.trim().toLowerCase()
}

export default function LayersDrawer() {
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	// 从 Context 获取图层面板 UI 状态
	const {
		collapsed,
		width,
		transitionAnimation,
		setCollapsed,
		getLayersScrollTop,
		setLayersScrollTop,
	} = useLayersUI()

	// 从 Context 获取 methods
	const { methods } = useMagic()

	// 图层展开状态
	const [expandedElementIds, setExpandedElementIds] = useState<Set<string>>(() => {
		if (methods?.getStorage) {
			try {
				const storageData = methods.getStorage()
				if (storageData?.expandedElementIds) {
					return new Set(storageData.expandedElementIds)
				}
			} catch (error) {
				console.error("加载 expandedElementIds 状态失败:", error)
			}
		}
		return new Set<string>()
	})
	// 监听画布 hover 事件，同步到图层面板
	const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
	// 独立记录鼠标是否正在图层列表行内，避免依赖跨 CSS Module 的 hover 选择器
	const [hoveredLayerItemId, setHoveredLayerItemId] = useState<string | null>(null)
	const [layerSearchValue, setLayerSearchValue] = useState("")
	const [isLayersFilterOpen, setIsLayersFilterOpen] = useState(false)
	const [isSelectMode, setIsSelectMode] = useState(false)
	const [layersFilter, setLayersFilter] = useState<CanvasLayersFilterState>(() => {
		if (methods?.getStorage) {
			try {
				return normalizeLayersFilter(methods.getStorage()?.layersFilter)
			} catch (error) {
				console.error("加载 layersFilter 状态失败:", error)
			}
		}
		return { ...DEFAULT_LAYERS_FILTER }
	})
	const layerRefreshScheduler = useMemo(() => createLayerRefreshScheduler(), [])

	useEffect(() => {
		return () => layerRefreshScheduler.dispose()
	}, [layerRefreshScheduler])

	// 订阅并获取画布数据
	const elements = useCanvasData(
		(manager) => manager.getAllElements(),
		[
			"element:change",
			"element:rerendered",
			"element:image:generate-submit-started",
			"element:image:generate-submit-failed",
			"element:image:resultUpdated",
			"element:video:generate-submit-started",
			"element:video:generate-submit-failed",
			"element:media:replaceStateChanged",
			"element:image:ossSrcReady",
		],
		{
			shouldUpdateOnElementChange: (event) => event.data?.phase !== "transient",
			scheduleUpdate: layerRefreshScheduler.schedule,
			shouldUpdateOnEvent: (event) => {
				if (event.type !== "element:rerendered") return true
				const rerenderedEvent = event as CanvasEvent<"element:rerendered">
				return (
					rerenderedEvent.data.data.type === ElementTypeEnum.Image ||
					rerenderedEvent.data.data.type === ElementTypeEnum.Video
				)
			},
		},
	)

	// 获取操作方法
	const { canvas } = useCanvas()

	// 获取元素菜单方法
	const { openMenu } = useElementMenu()

	// 从 Context 获取画布 UI 状态
	const { layerRenamingElementId, setLayerRenamingElementId, selectedElementIds } = useCanvasUI()
	const canWrite = canvas?.permissionManager?.can("document.write") ?? false

	// 将画布数据转换为树形结构，先按 zIndex 降序排序（zIndex 大的在上面）
	const treeData = useMemo(() => {
		if (collapsed || !elements) return []
		const sortedFrames = [...elements].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
		return sortedFrames.map((frame) => convertLayerToTreeNode(frame, canvas))
	}, [collapsed, elements, canvas])

	const normalizedLayerSearchKeyword = useMemo(
		() => normalizeLayerSearchKeyword(layerSearchValue),
		[layerSearchValue],
	)
	const isLayerSearching = normalizedLayerSearchKeyword.length > 0
	const isLayerFiltering = hasActiveLayersFilter(layersFilter)
	const filteredTreeData = useMemo(
		() => filterLayerTreeData(treeData, normalizedLayerSearchKeyword, layersFilter),
		[treeData, normalizedLayerSearchKeyword, layersFilter],
	)
	const selectableLayerIds = useMemo(
		() => collectAllLayerIds(filteredTreeData),
		[filteredTreeData],
	)
	const isAllSelectableSelected = areAllLayersChecked(filteredTreeData, selectedElementIds)
	const isPartiallySelected = areSomeLayersChecked(filteredTreeData, selectedElementIds)
	const searchExpandedElementIds = useMemo(() => {
		if (!isLayerSearching && !isLayerFiltering) {
			return expandedElementIds
		}
		return collectExpandableNodeIds(filteredTreeData, new Set(expandedElementIds))
	}, [expandedElementIds, filteredTreeData, isLayerFiltering, isLayerSearching])

	// 获取选中的元素 ID（只读下与画布选区一致，便于高亮与定位）
	const selectedIds = useMemo(() => selectedElementIds, [selectedElementIds])

	// 获取悬浮的元素 ID
	const hoveredIds = useMemo(() => {
		return hoveredElementId ? [hoveredElementId] : []
	}, [hoveredElementId])

	// 切换展开状态
	const toggleExpandedElement = useCallback((id: string) => {
		setExpandedElementIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}, [])

	// 多选时点选中行的锁/眼睛，与右键菜单一样作用于整次选择。
	const toggleLocked = useCallback(
		(elementId: string, currentLocked: boolean) => {
			if (!canvas) return
			if (selectedElementIds.length > 1 && selectedElementIds.includes(elementId)) {
				canvas.userActionRegistry.execute("element.toggle-lock")
				return
			}
			canvas.setElementLock(elementId, !currentLocked)
		},
		[canvas, selectedElementIds],
	)

	const toggleVisible = useCallback(
		(elementId: string, currentVisible: boolean) => {
			if (!canvas) return
			if (selectedElementIds.length > 1 && selectedElementIds.includes(elementId)) {
				canvas.userActionRegistry.execute("element.toggle-visible")
				return
			}
			canvas.setElementVisible(elementId, !currentVisible)
		},
		[canvas, selectedElementIds],
	)

	const stopPropagation = useCallback((event: React.MouseEvent) => {
		event.stopPropagation()
	}, [])

	const handleLayerSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setLayerSearchValue(event.target.value)
	}, [])

	const handleClearLayerSearch = useCallback((event: React.MouseEvent) => {
		event.stopPropagation()
		setLayerSearchValue("")
	}, [])

	const updateLayersFilter = useCallback(
		<K extends keyof CanvasLayersFilterState>(key: K, value: CanvasLayersFilterState[K]) => {
			setLayersFilter((previous) => ({ ...previous, [key]: value }))
		},
		[],
	)

	const resetLayersFilter = useCallback(() => {
		setLayersFilter({ ...DEFAULT_LAYERS_FILTER })
	}, [])

	const clearLayerSelection = useCallback(() => {
		canvas?.selectionManager.deselectAll()
	}, [canvas])

	const handleEnterSelectMode = useCallback(() => {
		setIsSelectMode(true)
	}, [])

	const handleCancelSelectMode = useCallback(() => {
		setIsSelectMode(false)
		clearLayerSelection()
	}, [clearLayerSelection])

	const handleSelectAllLayers = useCallback(() => {
		// Compact selection: selecting each visible root checks the whole subtree.
		canvas?.selectionManager.replaceSelection(
			filteredTreeData.map((node) => node.id),
			false,
		)
	}, [canvas, filteredTreeData])

	const handleToggleSelectAllLayers = useCallback(() => {
		if (isAllSelectableSelected) {
			clearLayerSelection()
			return
		}
		handleSelectAllLayers()
	}, [clearLayerSelection, handleSelectAllLayers, isAllSelectableSelected])

	const toggleLayerSelection = useCallback(
		(layerId: string) => {
			if (!canvas) return
			const nextIds = toggleLayerTreeSelection(filteredTreeData, selectedElementIds, layerId)
			canvas.selectionManager.replaceSelection(nextIds, false)
		},
		[canvas, filteredTreeData, selectedElementIds],
	)

	useEffect(() => {
		if (!methods?.saveStorage) return
		try {
			const existingData = methods.getStorage() || {}
			methods.saveStorage({
				...existingData,
				layersFilter: hasActiveLayersFilter(layersFilter) ? layersFilter : undefined,
			})
		} catch (error) {
			console.error("保存 layersFilter 状态失败:", error)
		}
	}, [layersFilter, methods])

	const renderLayerNode = useCallback(
		(node: TreeNode<LayerTreeData>, context: RenderNodeContext) => {
			const isLocked = node.data?.locked ?? false
			const isVisible = node.data?.visible ?? true
			const editableName = node.data?.editableName ?? node.label
			const isDiscarded =
				node.data?.type === ElementTypeEnum.Image &&
				canvas?.getEffectiveContent<ImageElementContent>(node.id)?.discarded === true
			const isEditing = layerRenamingElementId === node.id
			const isLayerItemHovered = hoveredLayerItemId === node.id
			const LockIcon = isLocked ? LockKeyhole : LockOpen
			const VisibilityIcon = isVisible ? Eye : EyeClosed

			let iconContent: React.ReactNode = null
			const mediaElement =
				node.data?.type === ElementTypeEnum.Image ||
				node.data?.type === ElementTypeEnum.Video ||
				node.data?.type === ElementTypeEnum.Audio
					? (node.data as ImageElement | VideoElement | AudioElement)
					: null
			switch (node.data?.type) {
				case ElementTypeEnum.Frame:
					iconContent = <FolderIcon size={16} className={styles.layerNodeFolderIcon} />
					break
				case ElementTypeEnum.Group:
					iconContent = <Folder size={16} className={styles.layerNodeFolderIcon} />
					break
				case ElementTypeEnum.Text:
					iconContent = <Type size={16} className={styles.layerNodeTextIcon} />
					break
				case ElementTypeEnum.Image:
					iconContent = null
					break
				case ElementTypeEnum.Rectangle:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<RectanglePreview element={node.data as RectangleElement} />
						</div>
					)
					break
				case ElementTypeEnum.Ellipse:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<EllipsePreview element={node.data as EllipseElement} />
						</div>
					)
					break
				case ElementTypeEnum.Triangle:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<TrianglePreview element={node.data as TriangleElement} />
						</div>
					)
					break
				case ElementTypeEnum.Star:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<StarPreview element={node.data as StarElement} />
						</div>
					)
					break
				case ElementTypeEnum.Video:
					iconContent = null
					break
				case ElementTypeEnum.VideoEdit:
					iconContent = <Film size={16} className={styles.layerNodeVideoIcon} />
					break
				case ElementTypeEnum.Audio:
					iconContent = null
					break
				case ElementTypeEnum.Storyboard:
					iconContent = <Workflow size={16} className={styles.layerNodeVideoIcon} />
					break
				default:
					iconContent = <div className={styles.layerNodeElementIcon}></div>
					break
			}

			// Escape should discard the draft even if unmounting the focused input emits blur.
			let cancelledByEscape = false
			const renderMainContent = (thumbnail?: React.ReactNode) => (
				<div className={styles.layerNodeMain}>
					<div className={styles.layerNodeIcon}>{thumbnail ?? iconContent}</div>
					<div className={styles.layerNodeLabel}>
						{isEditing ? (
							<Input
								className={cn(
									styles.layerNodeInput,
									context.noHoverClassName,
									context.noActiveClassName,
								)}
								defaultValue={editableName}
								autoFocus
								onFocus={(event) => event.currentTarget.select()}
								onClick={stopPropagation}
								onBlur={(e) => {
									const newName = e.target.value.trim()
									if (!cancelledByEscape && newName && newName !== editableName) {
										canvas?.elementRenameManager.commitElementName(
											node.id,
											newName,
										)
									}
									setLayerRenamingElementId(null)
								}}
								onKeyDown={(e) => {
									const nativeEvent = e.nativeEvent
									if (
										e.key === "Enter" &&
										!nativeEvent.isComposing &&
										nativeEvent.keyCode !== 229
									) {
										e.currentTarget.blur()
									} else if (e.key === "Escape") {
										cancelledByEscape = true
										e.currentTarget.value = editableName
										setLayerRenamingElementId(null)
									}
								}}
							/>
						) : (
							<div
								className={styles.layerNodeLabelText}
								onDoubleClick={(event) => {
									event.stopPropagation()
									if (!canvas?.elementRenameManager.canRename(node.id)) return
									setLayerRenamingElementId(node.id)
								}}
							>
								{node.label}
							</div>
						)}
						{isDiscarded && (
							<span className={styles.layerNodeDiscarded}>
								{t("elementBottomToolbar.discardedDraft", "废稿")}
							</span>
						)}
					</div>
				</div>
			)
			const renderActions = () => {
				if (isEditing || isSelectMode) return null
				return (
					<div className={styles.layerNodeActions}>
						<div
							className={cn(
								styles.layerNodeActionSlot,
								isLocked && styles.layerNodeActionSlotAlwaysVisible,
							)}
							data-media-preview-ignore-hover=""
							onPointerDown={(event) => event.stopPropagation()}
						>
							<IconButton
								className={cn(
									styles.layerNodeActionButton,
									!canWrite && styles.noHover,
									context.noHoverClassName,
									context.noActiveClassName,
								)}
								onClick={(e) => {
									if (!canWrite) return
									stopPropagation(e)
									toggleLocked(node.id, isLocked)
								}}
							>
								<LockIcon size={12} strokeWidth={2.5} />
							</IconButton>
						</div>
						<div
							className={cn(
								styles.layerNodeActionSlot,
								!isVisible && styles.layerNodeActionSlotAlwaysVisible,
							)}
							data-media-preview-ignore-hover=""
							onPointerDown={(event) => event.stopPropagation()}
						>
							<IconButton
								className={cn(
									styles.layerNodeActionButton,
									context.noHoverClassName,
									context.noActiveClassName,
								)}
								onClick={(e) => {
									if (!canWrite) return
									stopPropagation(e)
									toggleVisible(node.id, isVisible)
								}}
							>
								<VisibilityIcon size={12} strokeWidth={2.5} />
							</IconButton>
						</div>
					</div>
				)
			}

			const renderLayerRow = (thumbnail?: React.ReactNode) => (
				<div
					className={cn(styles.layerNode, isLayerItemHovered && styles.layerNodeHovered)}
				>
					{renderMainContent(thumbnail)}
					{renderActions()}
				</div>
			)

			return (
				<>
					{mediaElement ? (
						<LayerMediaPreview
							element={mediaElement}
							fileName={node.label}
							disabled={isEditing}
						>
							{renderLayerRow}
						</LayerMediaPreview>
					) : (
						renderLayerRow()
					)}
				</>
			)
		},
		[
			layerRenamingElementId,
			hoveredLayerItemId,
			stopPropagation,
			toggleLocked,
			toggleVisible,
			isSelectMode,
			canWrite,
			canvas,
			setLayerRenamingElementId,
			t,
		],
	)

	const renderLayerLeading = useCallback(
		(node: TreeNode<LayerTreeData>) => {
			if (!isSelectMode || layerRenamingElementId === node.id) return null
			const checkState = getLayerCheckState(filteredTreeData, selectedElementIds, node.id)
			return (
				<div
					className={styles.layerNodeCheckboxSlot}
					data-media-preview-ignore-hover=""
					onPointerDown={(event) => event.stopPropagation()}
					onDoubleClick={stopPropagation}
				>
					<Checkbox
						checked={
							checkState === "indeterminate"
								? "indeterminate"
								: checkState === "checked"
						}
						onCheckedChange={() => toggleLayerSelection(node.id)}
						onClick={stopPropagation}
						aria-label={node.label}
					/>
				</div>
			)
		},
		[
			filteredTreeData,
			isSelectMode,
			layerRenamingElementId,
			selectedElementIds,
			stopPropagation,
			toggleLayerSelection,
		],
	)

	const handleContextMenu = useCallback(
		(event: React.MouseEvent, node: TreeNode<LayerTreeData>) => {
			// 右键时也定位到元素
			if (canvas && node.id) {
				canvas.userActionRegistry.execute("view.focus-element", {
					elementIds: [node.id],
				})
			}
			openMenu(event, node.id, "layers")
		},
		[openMenu, canvas],
	)

	const handleMouseEnter = useCallback(
		(_event: React.MouseEvent, node: TreeNode<LayerTreeData>) => {
			setHoveredLayerItemId(node.id)
			// 在画布上显示 hover 效果
			canvas?.hoverManager.manualSetHover(node.id)
		},
		[canvas?.hoverManager],
	)

	const handleMouseLeave = useCallback(() => {
		setHoveredLayerItemId(null)
		// 清除画布上的 hover 效果
		canvas?.hoverManager.manualSetHover(null)
	}, [canvas?.hoverManager])

	const handleLayersScrollTopChange = useCallback(
		(scrollTop: number) => {
			setLayersScrollTop(scrollTop)
		},
		[setLayersScrollTop],
	)

	// 监听画框创建事件，自动展开新创建的画框
	useCanvasEvent("frame:created", (event) => {
		if (event.data?.frameId) {
			setExpandedElementIds((prev) => {
				const next = new Set(prev)
				next.add(event.data.frameId)
				return next
			})
		}
	})

	// 监听画布 hover 事件，同步到图层面板
	useCanvasEvent("element:hover", (event) => {
		setHoveredElementId(event.data?.elementId ?? null)
	})

	// 监听 expandedElementIds 变化，直接保存到 storage
	useEffect(() => {
		if (!methods?.saveStorage) {
			return
		}
		try {
			// 先获取现有的 storage 数据
			const existingData = methods.getStorage() || {}
			const storageData: CanvasDesignStorageData = {
				...existingData,
				expandedElementIds:
					expandedElementIds.size > 0 ? Array.from(expandedElementIds) : undefined,
			}
			methods.saveStorage(storageData)
		} catch (error) {
			console.error("保存 expandedElementIds 状态失败:", error)
		}
	}, [methods, expandedElementIds])

	return (
		<div
			className={cn(styles.layersDrawer, collapsed && styles.collapsed)}
			style={{
				width: width,
				transition: transitionAnimation,
			}}
			data-canvas-ui-component
		>
			<div className={styles.layersDrawerHeader}>
				{isSelectMode ? (
					<label className={styles.layersSelectModeHeader}>
						<Checkbox
							checked={
								isPartiallySelected
									? "indeterminate"
									: isAllSelectableSelected && selectableLayerIds.length > 0
							}
							onCheckedChange={handleToggleSelectAllLayers}
							aria-label={t("layers.batch.selectAll", "全选")}
						/>
						<span className={styles.layersSelectModeLabel}>
							{selectedElementIds.length > 0
								? t("layers.batch.selected", {
										defaultValue: "已选 {{count}} 项",
										count: selectedElementIds.length,
									})
								: t("layers.batch.selectAll", "全选")}
						</span>
					</label>
				) : (
					<span className={styles.layersDrawerTitle}>{t("layers.title", "图层")}</span>
				)}
				{!collapsed && !!elements?.length && (
					<div className={styles.layersDrawerHeaderActions}>
						<div
							className={cn(
								styles.layersDrawerSearch,
								layerSearchValue && styles.layersDrawerSearchActive,
							)}
						>
							<Search size={14} className={styles.layersSearchIcon} />
							<Input
								className={styles.layersSearchInput}
								value={layerSearchValue}
								placeholder={t("layers.search.placeholder", "搜索图层")}
								onChange={handleLayerSearchChange}
								onClick={(event) => event.stopPropagation()}
								onKeyDown={(event) => event.stopPropagation()}
							/>
							{layerSearchValue && (
								<IconButton
									className={styles.layersSearchClearButton}
									aria-label={t("layers.search.clear", "清空搜索")}
									onClick={handleClearLayerSearch}
								>
									<X size={12} strokeWidth={2.5} />
								</IconButton>
							)}
						</div>
						<div className={styles.layersFilterActions}>
							{isSelectMode ? (
								<button
									type="button"
									className={styles.layersSelectModeCancel}
									onClick={handleCancelSelectMode}
								>
									{t("layers.batch.cancel", "取消")}
								</button>
							) : (
								canWrite && (
									<button
										type="button"
										className={styles.layersFilterTrigger}
										aria-label={t("layers.batch.enter", "多选")}
										title={t("layers.batch.enter", "多选")}
										onClick={handleEnterSelectMode}
									>
										<SquareCheckBig size={14} />
									</button>
								)
							)}
							<LayersFilterPopover
								filter={layersFilter}
								isActive={isLayerFiltering}
								isOpen={isLayersFilterOpen}
								onOpenChange={setIsLayersFilterOpen}
								onFilterChange={updateLayersFilter}
								onReset={resetLayersFilter}
							/>
						</div>
					</div>
				)}
			</div>
			<div className={styles.layersDrawerBody}>
				{!collapsed &&
					(elements?.length ? (
						filteredTreeData.length ? (
							<Tree
								key={
									isLayerSearching || isLayerFiltering
										? `filter:${normalizedLayerSearchKeyword}:${layersFilter.visibility}:${layersFilter.locked}:${layersFilter.types.join(",")}`
										: "layers"
								}
								data={filteredTreeData}
								selectedIds={selectedIds}
								hoveredIds={hoveredIds}
								selectionMode="replace"
								treeNodeContentClassName={
									!canWrite ? styles.treeNodeContentViewOnly : undefined
								}
								virtualize
								virtualThreshold={LAYER_TREE_VIRTUAL_THRESHOLD}
								virtualRowHeight={LAYER_TREE_ROW_HEIGHT}
								initialScrollTop={
									isLayerSearching || isLayerFiltering ? 0 : getLayersScrollTop()
								}
								onScrollTopChange={
									isLayerSearching || isLayerFiltering
										? undefined
										: handleLayersScrollTopChange
								}
								onSelect={(_nodes, ids) => {
									const clickedId = ids[0]
									if (!clickedId) return
									if (isSelectMode) {
										toggleLayerSelection(clickedId)
										return
									}
									const hasSelectionChanged =
										ids.length !== selectedElementIds.length ||
										ids.some((id) => !selectedElementIds.includes(id)) ||
										selectedElementIds.some((id) => !ids.includes(id))
									canvas?.selectionManager.replaceSelection(
										ids,
										hasSelectionChanged,
									)
									if (ids.length > 0) {
										canvas?.userActionRegistry.execute("view.focus-element", {
											elementIds: ids,
										})
									}
								}}
								expandedIds={searchExpandedElementIds}
								onToggle={toggleExpandedElement}
								renderLeading={isSelectMode ? renderLayerLeading : undefined}
								renderNode={renderLayerNode}
								onContextMenu={handleContextMenu}
								onMouseEnter={handleMouseEnter}
								onMouseLeave={handleMouseLeave}
							/>
						) : (
							<div className={styles.layersSearchEmpty}>
								{isLayerFiltering
									? t("layers.filter.empty", "当前筛选条件下没有匹配图层")
									: t("layers.search.empty", "未找到匹配图层")}
							</div>
						)
					) : (
						<LayersEmpty />
					))}
			</div>
			<div className={styles.layersDrawerFooter}>
				<Tooltip delayDuration={0}>
					<TooltipTrigger>
						<IconButton
							className={styles.layersDrawerCollapseButton}
							onClick={() => setCollapsed(true)}
						>
							<MinimizeIcon size={16} />
						</IconButton>
					</TooltipTrigger>
					<TooltipPrimitive.Portal container={portalContainer || undefined}>
						<TooltipContent
							side="top"
							sideOffset={4}
							className="border-black bg-black text-white"
						>
							<span>{t("layers.collapse", "收起")}</span>
							<TooltipPrimitive.Arrow className="fill-black" />
						</TooltipContent>
					</TooltipPrimitive.Portal>
				</Tooltip>
				{!collapsed && isSelectMode && (
					<LayerBatchToolbar selectedIds={selectedElementIds} />
				)}
			</div>
		</div>
	)
}
