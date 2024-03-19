import { useCallback, useMemo, useState, useEffect } from "react"
import styles from "./index.module.css"
import IconButton from "../../../ui/custom/IconButton/index"
import {
	Minimize2 as MinimizeIcon,
	LockOpen,
	LockKeyhole,
	Eye,
	EyeClosed,
	FolderIcon,
	Folder,
	Type,
	Image,
} from "../../../ui/icons/index"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Input } from "../../../ui/input"
import LayersEmpty from "../LayersEmpty"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../ui/tooltip"
import { usePortalContainer } from "../../../ui/custom/PortalContainerContext"
import classNames from "classnames"
import Tree, { type TreeNode, type RenderNodeContext } from "../../../ui/custom/Tree/index"
import {
	ElementTypeEnum,
	type RectangleElement,
	type EllipseElement,
	type TriangleElement,
	type StarElement,
} from "../../../../canvas/types"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasData } from "../../../../hooks/useCanvasData"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useLayersUI } from "../../../../context/LayersUIContext"
import { useElementMenu } from "../../../ElementMenu/ElementMenuContext"
import { useMagic } from "../../../../context/MagicContext"
import type { CanvasDesignStorageData } from "../../../../types.magic"
import { useImageUrls } from "../../../../hooks/useImageUrls"
import { useCanvasEvent } from "../../../../hooks/useCanvasEvent"
import { RectangleThumbnail } from "./thumbnails/RectangleThumbnail"
import { EllipseThumbnail } from "./thumbnails/EllipseThumbnail"
import { TriangleThumbnail } from "./thumbnails/TriangleThumbnail"
import { StarThumbnail } from "./thumbnails/StarThumbnail"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import type { LayerTreeData } from "../../types"
import { convertLayerToTreeNode } from "../../../../lib"

export default function LayersDrawer() {
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	// 从 Context 获取图层面板 UI 状态
	const { collapsed, width, transitionAnimation, setCollapsed } = useLayersUI()

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

	// 订阅并获取画布数据
	const elements = useCanvasData((manager) => manager.getAllElements())

	// 获取操作方法
	const { canvas } = useCanvas()

	// 获取元素菜单方法
	const { openMenu } = useElementMenu()

	// 获取图片 URL 映射（仅在图层展开时获取）
	const imageUrls = useImageUrls(!collapsed)

	// 从 Context 获取画布 UI 状态
	const { editingElementId, setEditingElementId, selectedElementIds, readonly } = useCanvasUI()

	// 将画布数据转换为树形结构，先按 zIndex 降序排序（zIndex 大的在上面）
	const treeData = useMemo(() => {
		if (!elements) return []
		const sortedFrames = [...elements].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
		return sortedFrames.map((frame) => convertLayerToTreeNode(frame, canvas))
	}, [elements, canvas])

	// 获取选中的元素 ID
	const selectedIds = useMemo(() => {
		return readonly ? [] : selectedElementIds
	}, [readonly, selectedElementIds])

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

	// 切换锁定状态
	const toggleLocked = useCallback(
		(elementId: string, currentLocked: boolean) => {
			if (!canvas) return
			const willLock = !currentLocked
			canvas.setElementLock(elementId, willLock)
		},
		[canvas],
	)

	// 切换可见性
	const toggleVisible = useCallback(
		(elementId: string, currentVisible: boolean) => {
			if (!canvas) return
			canvas.setElementVisible(elementId, !currentVisible)
		},
		[canvas],
	)

	const stopPropagation = useCallback((event: React.MouseEvent) => {
		event.stopPropagation()
	}, [])

	const renderLayerNode = useCallback(
		(node: TreeNode<LayerTreeData>, context: RenderNodeContext) => {
			const isLocked = node.data?.locked ?? false
			const isVisible = node.data?.visible ?? true
			const isEditing = editingElementId === node.id
			const LockIcon = isLocked ? LockKeyhole : LockOpen
			const VisibilityIcon = isVisible ? Eye : EyeClosed

			let iconContent: React.ReactNode = null
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
					const imageUrl = imageUrls.get(node.id)
					if (imageUrl) {
						// 使用 key 属性稳定 img 元素，避免 hover 时重新创建导致浏览器重新加载
						iconContent = (
							<div className={styles.layerNodeElementIcon}>
								<img
									key={imageUrl}
									src={imageUrl}
									alt={node.label}
									loading="lazy"
									decoding="async"
								/>
							</div>
						)
					} else {
						iconContent = <Image size={16} className={styles.layerNodeImageIcon} />
					}
					break
				case ElementTypeEnum.Rectangle:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<RectangleThumbnail element={node.data as RectangleElement} />
						</div>
					)
					break
				case ElementTypeEnum.Ellipse:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<EllipseThumbnail element={node.data as EllipseElement} />
						</div>
					)
					break
				case ElementTypeEnum.Triangle:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<TriangleThumbnail element={node.data as TriangleElement} />
						</div>
					)
					break
				case ElementTypeEnum.Star:
					iconContent = (
						<div className={styles.layerNodeElementIcon}>
							<StarThumbnail element={node.data as StarElement} />
						</div>
					)
					break
				default:
					iconContent = <div className={styles.layerNodeElementIcon}></div>
					break
			}

			return (
				<div className={styles.layerNode}>
					<div className={styles.layerNodeIcon}>{iconContent}</div>
					<div className={styles.layerNodeLabel}>
						{isEditing ? (
							<Input
								className={classNames(
									styles.layerNodeInput,
									context.noHoverClassName,
									context.noActiveClassName,
								)}
								defaultValue={node.label}
								autoFocus
								onClick={stopPropagation}
								onBlur={(e) => {
									const newName = e.target.value.trim()
									if (newName && newName !== node.label) {
										canvas?.elementManager.update(node.id, { name: newName })
									}
									setEditingElementId(null)
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.currentTarget.blur()
									} else if (e.key === "Escape") {
										setEditingElementId(null)
									}
								}}
							/>
						) : (
							<div className={styles.layerNodeLabelText}>{node.label}</div>
						)}
					</div>
					{!isEditing && (
						<div className={styles.layerNodeActions}>
							<div
								className={classNames(
									// 锁定按钮：当被锁定时一直显示，否则只在 hover 时显示
									!isLocked && context.showOnHoverClassName,
									readonly && !isLocked && styles.hidden,
								)}
							>
								<IconButton
									className={classNames(
										styles.layerNodeActionButton,
										readonly && styles.noHover,
										context.noHoverClassName,
										context.noActiveClassName,
									)}
									onClick={(e) => {
										if (readonly) return
										stopPropagation(e)
										toggleLocked(node.id, isLocked)
									}}
								>
									<LockIcon size={12} strokeWidth={2.5} />
								</IconButton>
							</div>
							<div
								className={classNames(
									// 可见性按钮：当不可见时一直显示，否则只在 hover 时显示
									isVisible && context.showOnHoverClassName,
								)}
							>
								<IconButton
									className={classNames(
										styles.layerNodeActionButton,
										context.noHoverClassName,
										context.noActiveClassName,
									)}
									onClick={(e) => {
										stopPropagation(e)
										toggleVisible(node.id, isVisible)
									}}
								>
									<VisibilityIcon size={12} strokeWidth={2.5} />
								</IconButton>
							</div>
						</div>
					)}
				</div>
			)
		},
		[
			editingElementId,
			stopPropagation,
			toggleLocked,
			toggleVisible,
			readonly,
			canvas,
			setEditingElementId,
			imageUrls,
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

	const handleDoubleClick = useCallback(
		(event: React.MouseEvent, node: TreeNode<LayerTreeData>) => {
			// readonly 状态下不允许编辑名称
			if (readonly) {
				return
			}
			// 双击进入编辑模式
			setEditingElementId(node.id)
		},
		[readonly, setEditingElementId],
	)

	const handleMouseEnter = useCallback(
		(event: React.MouseEvent, node: TreeNode<LayerTreeData>) => {
			// 在画布上显示 hover 效果
			canvas?.hoverManager.manualSetHover(node.id)
		},
		[canvas?.hoverManager],
	)

	const handleMouseLeave = useCallback(
		(event: React.MouseEvent, node: TreeNode<LayerTreeData>) => {
			// 清除画布上的 hover 效果
			canvas?.hoverManager.manualSetHover(null)
		},
		[canvas?.hoverManager],
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
			className={classNames(
				styles.layersDrawer,
				collapsed && styles.collapsed,
				readonly && styles.readonly,
			)}
			style={{
				width: width,
				transition: transitionAnimation,
			}}
			data-canvas-ui-component
		>
			<div className={styles.layersDrawerHeader}>{t("layers.title", "图层")}</div>
			<div className={styles.layersDrawerBody}>
				{elements?.length ? (
					<Tree
						data={treeData}
						selectedIds={selectedIds}
						hoveredIds={hoveredIds}
						treeNodeContentClassName={
							readonly ? styles.treeNodeContentReadonly : undefined
						}
						onSelect={(_nodes, ids) => {
							if (readonly) return
							const isLocked = ids.some(
								(id) => canvas?.elementManager.getElementData(id)?.locked === true,
							)
							if (!isLocked) {
								// 智能判断：只有当选中状态发生变化时才自动聚焦
								// 比较新旧选中的元素ID，判断是否有变化
								const hasSelectionChanged =
									ids.length !== selectedElementIds.length ||
									ids.some((id) => !selectedElementIds.includes(id)) ||
									selectedElementIds.some((id) => !ids.includes(id))
								canvas?.selectionManager.selectMultiple(
									ids,
									false,
									hasSelectionChanged,
								)
								// 定位到选中的元素
								if (ids.length > 0) {
									canvas?.userActionRegistry.execute("view.focus-element", {
										elementIds: ids,
									})
								}
							}
						}}
						expandedIds={expandedElementIds}
						onToggle={toggleExpandedElement}
						renderNode={renderLayerNode}
						onContextMenu={handleContextMenu}
						onDoubleClick={handleDoubleClick}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
					/>
				) : (
					<LayersEmpty />
				)}
			</div>
			<div className={styles.layersDrawerFooter}>
				<Tooltip>
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
			</div>
		</div>
	)
}
