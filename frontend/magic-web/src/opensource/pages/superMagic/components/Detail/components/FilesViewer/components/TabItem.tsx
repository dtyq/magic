import { memo, useMemo } from "react"
import { Tooltip } from "antd"
import { IconX, IconLock } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/opensource/lib/utils"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { getAttachmentExtension } from "@/opensource/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { calculateCalvedRelativePath } from "../utils/tabUtils"
import type { TabItem as TabItemType } from "../types"
import type { TabContextMenuState } from "../hooks/useTabContextMenu"
import {
	handleTabDragEnd as handleTabDragEndMessageEditor,
	handleTabDragStart as handleTabDragStartMessageEditor,
} from "../../../../MessageEditor/utils/drag"

interface TabItemProps {
	tab: TabItemType
	index: number
	allTabs: TabItemType[]
	isActive: boolean
	isDragging: boolean
	isDragOver: boolean
	dragDirection?: "left" | "right"
	isPlayback: boolean
	contextMenuState?: TabContextMenuState
	onSwitchToTab: (tabId: string) => void
	onCloseTab: (tabId: string) => void
	onDragStart?: (e: React.DragEvent, tab: TabItemType) => void
	onDragEnd?: (e: React.DragEvent) => void
	onDragOver?: (e: React.DragEvent, index: number) => void
	onDrop?: (e: React.DragEvent, index: number) => void
}

// 获取文件路径用作tooltip的工具函数
const getFileTooltip = (tab: TabItemType, unknownFileText: string) => {
	const fileData = tab?.fileData || {}
	const filePath = fileData.relative_file_path || ""

	const name =
		fileData.display_filename ||
		fileData.file_name ||
		fileData.filename ||
		tab?.title ||
		tab?.name ||
		unknownFileText

	if (filePath) {
		const parts = filePath.split("/")
		parts.pop()
		return parts.join("/")
	}

	return name
}

/**
 * TabItem 组件 - 单个标签页项
 * 使用 memo 优化性能，避免不必要的重新渲染和相对路径计算
 */
const TabItem = memo<TabItemProps>(
	({
		tab,
		index,
		allTabs,
		isActive,
		isDragging,
		isDragOver,
		dragDirection,
		isPlayback,
		contextMenuState,
		onSwitchToTab,
		onCloseTab,
		onDragStart,
		onDragEnd,
		onDragOver,
		onDrop,
	}) => {
		const { t } = useTranslation("super")
		const isDeleted = tab.isDeleted

		// 当右键菜单显示且是当前 tab 时，隐藏 Tooltip
		const tooltipOpen = useMemo(() => {
			if (contextMenuState?.visible) {
				return false
			}
			return undefined
		}, [contextMenuState?.visible])

		// 获取当前标签页显示的文件名（与渲染逻辑保持一致）
		const getDisplayFileName = (tabItem: TabItemType) => {
			return tabItem.title || tabItem.name || tabItem?.fileData?.metadata?.name
		}

		// 使用 useMemo 缓存相对路径计算，只有在依赖项变化时才重新计算
		const relativePath = useMemo(() => {
			// 只有多个tab时才显示相对路径
			if (allTabs.length <= 1) return ""

			// 动态计算相对路径
			const currentFilePath = tab.fileData.relative_file_path || tab.filePath
			if (!currentFilePath) return ""

			// 获取当前标签页显示的文件名
			const currentDisplayName = getDisplayFileName(tab)
			if (!currentDisplayName) return ""

			// 找到所有同名文件的路径（基于显示名称，而不是路径中的文件名）
			const duplicatePaths = allTabs
				.filter((t) => {
					const otherFilePath = t.fileData.relative_file_path || t.filePath
					if (!otherFilePath || otherFilePath === currentFilePath) return false
					const otherDisplayName = getDisplayFileName(t)
					return otherDisplayName === currentDisplayName
				})
				.map((t) => t.fileData.relative_file_path || t.filePath)
				.filter(Boolean) as string[]

			// 如果没有重名文件，不显示相对路径
			if (duplicatePaths.length === 0) return ""

			// 计算相对路径
			return calculateCalvedRelativePath(currentFilePath, duplicatePaths)
		}, [
			allTabs.length,
			tab.fileData.relative_file_path,
			tab.filePath,
			// 为了检测重名变化，我们需要依赖所有tab的显示名称和文件路径
			allTabs
				.map(
					(t) =>
						`${getDisplayFileName(t)}|${t.fileData.relative_file_path || t.filePath}`,
				)
				.join(","),
		])

		const handleClick = () => {
			onSwitchToTab(tab.id)
		}

		const handleClose = (e: React.MouseEvent) => {
			e.stopPropagation()
			onCloseTab(tab.id)
		}

		const handleDragStart = (e: React.DragEvent) => {
			if (!isPlayback && onDragStart) {
				onDragStart(e, tab)
				handleTabDragStartMessageEditor(e, tab)
			}
		}

		const handleDragEnd = (e: React.DragEvent) => {
			if (!isPlayback && onDragEnd) {
				onDragEnd(e)
				handleTabDragEndMessageEditor(e)
			}
		}

		const handleDragOver = (e: React.DragEvent) => {
			if (onDragOver) {
				onDragOver(e, index)
			}
		}

		const handleDrop = (e: React.DragEvent) => {
			if (onDrop) {
				onDrop(e, index)
			}
		}

		return (
			<Tooltip
				title={getFileTooltip(tab, t("fileViewer.unknownFile"))}
				placement="bottom"
				mouseEnterDelay={0.5}
				open={tooltipOpen}
				classNames={{
					root: cn("max-w-[500px]", "files-viewer-tooltip"),
				}}
			>
				<div
					className={cn(
						"relative flex h-7 shrink-0 select-none items-center justify-center gap-1 overflow-visible whitespace-nowrap rounded-lg px-2 py-1.5 transition-all duration-200",
						isPlayback ? "cursor-pointer" : "cursor-grab",
						!isPlayback && "hover:bg-black/5",
						isActive && "bg-background shadow-sm shadow-black/10 hover:bg-background",
						isDragging && !isPlayback && "z-[1000] scale-95 cursor-grabbing opacity-60",
						isDragOver && "bg-primary-10",
						isDragOver &&
							dragDirection === "left" &&
							"translate-x-[2px] border-l-[3px] border-l-primary",
						isDragOver &&
							dragDirection === "right" &&
							"-translate-x-[2px] border-r-[3px] border-r-primary",
					)}
					onClick={handleClick}
					data-tab-id={tab.id}
					draggable={!isPlayback}
					onDragStart={!isPlayback ? handleDragStart : undefined}
					onDragEnd={!isPlayback ? handleDragEnd : undefined}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
				>
					<MagicFileIcon
						type={
							isPlayback
								? "replay"
								: getAttachmentExtension(tab?.fileData?.metadata) ||
									tab.fileData?.file_extension ||
									""
						}
						className="size-4 shrink-0 rounded-[2px] object-cover"
						size={16}
					/>
					<span
						className={cn(
							"max-w-[160px] truncate font-sans text-xs font-normal leading-4 text-foreground",
							isDeleted && "text-destructive line-through",
						)}
					>
						{tab.title || tab.name || tab?.fileData?.metadata?.name}
					</span>
					<span
						className={cn(
							"max-w-[140px] truncate font-sans text-xs font-light leading-4 text-muted-foreground",
							(!relativePath || isDeleted) && "hidden",
						)}
					>
						{relativePath}
					</span>
					{isDeleted && (
						<span className="flex items-center gap-1 font-sans text-xs font-normal leading-4 text-destructive">
							{t("fileViewer.tabs.deleted")}
							<MagicIcon component={IconLock} size={14} color="currentColor" />
						</span>
					)}
					<div
						className={cn(
							"flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground transition-colors duration-200 hover:bg-black/10",
							isActive && "text-foreground/80",
						)}
						onClick={handleClose}
					>
						<IconX size={12} />
					</div>
				</div>
			</Tooltip>
		)
	},
)

TabItem.displayName = "TabItem"

export default TabItem
