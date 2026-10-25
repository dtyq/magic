import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
import { getFileDisplayPath } from "@/pages/superMagic/utils/markdownFileReference"
import { memo, useMemo } from "react"
import { Tooltip } from "antd"
import MagicTooltip from "@/components/base/MagicTooltip"
import { IconX, IconLock } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import MagicIcon from "@/components/base/MagicIcon"
import { MagicLoadingIcon } from "@/components/base/MagicLoadingIcon"
import { isMagicProjectConfigFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { calculateCalvedRelativePath } from "../utils/tabUtils"
import type { FileItem, TabItem as TabItemType } from "../types"
import { FileTabMagicIcon } from "./FileTabMagicIcon"
import type { TabContextMenuState } from "../hooks/useTabContextMenu"
import {
	handleTabDragEnd as handleTabDragEndMessageEditor,
	handleTabDragStart as handleTabDragStartMessageEditor,
} from "../../../../MessageEditor/utils/drag"

interface TabItemProps {
	context?: FileHelpContext
	tab: TabItemType
	allTabs: TabItemType[]
	isActive: boolean
	isDragging: boolean
	isPlayback: boolean
	contextMenuState?: TabContextMenuState
	/** 用于解析 custom icon（入口文件需父目录子树） */
	attachments?: FileItem[]
	onSwitchToTab: (tabId: string) => void
	onCloseTab: (tabId: string) => void
	onDragStart?: (e: React.DragEvent, tab: TabItemType) => void
	onDragEnd?: (e: React.DragEvent) => void
}

// 获取文件路径用作tooltip的工具函数
const getFileTooltip = (tab: TabItemType, unknownFileText: string) => {
	const fileData = tab?.fileData || {}
	const filePath = getFileDisplayPath(fileData)

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
		const parent = parts.join("/")
		const isUser = (fileData.file_reference?.space_type ?? fileData.space_type) === "user"
		return isUser && parent === "~" ? "~/" : parent || name
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
		allTabs,
		isActive,
		isDragging,
		isPlayback,
		contextMenuState,
		attachments,
		context,
		onSwitchToTab,
		onCloseTab,
		onDragStart,
		onDragEnd,
	}) => {
		const { t } = useTranslation("super")
		const displayConfig = (
			tab?.fileData as { display_config?: Record<string, unknown> } | undefined
		)?.display_config
		const isLoading = tab.isLoading
		const isRecycleBin = Boolean(tab.fileData.recycleBin)
		// 回收站与普通已删除标签共用外观，但回收站仍能只读预览。
		// 此条件只控制标签展示，不能写回会触发内容不可用页面的 tab.isDeleted。
		const showDeletedStatus = Boolean(tab.isDeleted || isRecycleBin)

		// 当右键菜单显示且是当前 tab 时，隐藏 Tooltip
		const tooltipOpen = useMemo(() => {
			if (contextMenuState?.visible || isDragging) {
				return false
			}
			return undefined
		}, [contextMenuState?.visible, isDragging])

		// 获取当前标签页显示的文件名（与渲染逻辑保持一致）
		const getDisplayFileName = (tabItem: TabItemType) => {
			const fileName =
				tabItem?.fileData?.file_name ||
				tabItem?.fileData?.display_filename ||
				tabItem?.fileData?.filename
			if (isMagicProjectConfigFile(fileName)) {
				return fileName
			}
			return tabItem.title || tabItem.name || tabItem?.fileData?.display_config?.name
		}

		// 使用 useMemo 缓存相对路径计算，只有在依赖项变化时才重新计算
		const relativePath = useMemo(() => {
			// 只有多个tab时才显示相对路径
			if (allTabs.length <= 1) return ""

			// 动态计算相对路径
			const currentFilePath = getFileDisplayPath({
				...tab.fileData,
				relative_file_path: tab.fileData.relative_file_path ?? tab.filePath,
			})
			if (!currentFilePath) return ""

			// 获取当前标签页显示的文件名
			const currentDisplayName = getDisplayFileName(tab)
			if (!currentDisplayName) return ""

			// 找到所有同名文件的路径（基于显示名称，而不是路径中的文件名）
			const duplicatePaths = allTabs
				.filter((t) => {
					const otherFilePath = getFileDisplayPath({
						...t.fileData,
						relative_file_path: t.fileData.relative_file_path ?? t.filePath,
					})
					if (!otherFilePath || otherFilePath === currentFilePath) return false
					const otherDisplayName = getDisplayFileName(t)
					return otherDisplayName === currentDisplayName
				})
				.map((t) => t.fileData.relative_file_path || t.filePath)
				.filter(Boolean) as string[]

			// 如果没有重名文件，不显示相对路径
			if (duplicatePaths.length === 0) return ""

			// 计算相对路径
			return calculateCalvedRelativePath(
				currentFilePath,
				duplicatePaths,
				tab.fileData.file_reference?.space_type ?? tab.fileData.space_type,
			)
		}, [
			allTabs.length,
			tab.fileData,
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
				if (e.defaultPrevented) return
				if (tab.type !== "file_manager" && !tab.fileData.recycleBin)
					handleTabDragStartMessageEditor(e, tab)
			}
		}

		const handleDragEnd = (e: React.DragEvent) => {
			if (!isPlayback && onDragEnd) {
				onDragEnd(e)
				handleTabDragEndMessageEditor(e)
			}
		}

		return (
			<Tooltip
				title={isRecycleBin ? undefined : getFileTooltip(tab, t("fileViewer.unknownFile"))}
				placement="bottom"
				mouseEnterDelay={0.5}
				open={tooltipOpen}
				classNames={{
					root: cn("max-w-[500px]", "files-viewer-tooltip"),
				}}
			>
				<div
					className={cn(
						"relative flex h-7 shrink-0 select-none items-center justify-center gap-1 overflow-visible whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors duration-200",
						isPlayback ? "cursor-pointer" : "cursor-grab",
						!isPlayback && "hover:bg-black/5",
						isActive && "bg-background shadow-sm shadow-black/10 hover:bg-background",
					)}
					onClick={handleClick}
					data-tab-id={tab.id}
					draggable={!isPlayback}
					onDragStart={!isPlayback ? handleDragStart : undefined}
					onDragEnd={!isPlayback ? handleDragEnd : undefined}
					data-testid="handle-click"
				>
					<FileTabMagicIcon
						tab={tab}
						attachments={attachments}
						context={context}
						isPlayback={isPlayback}
						size={16}
						className="size-4 shrink-0 rounded-[2px] object-cover"
					/>
					<MagicTooltip
						title={
							isRecycleBin
								? `${getDisplayFileName(tab)} · ${t("recycleBin.preview.readonly")}`
								: undefined
						}
						placement="bottom"
						disabled={tooltipOpen === false}
					>
						<span
							className={cn(
								"max-w-[160px] truncate font-sans text-xs font-normal leading-4 text-foreground",
								showDeletedStatus && "text-destructive line-through",
								isLoading && "text-muted-foreground",
							)}
							aria-label={
								isRecycleBin
									? `${getDisplayFileName(tab)} · ${t("recycleBin.preview.readonly")}`
									: undefined
							}
						>
							{getDisplayFileName(tab)}
						</span>
					</MagicTooltip>
					{isLoading && <MagicLoadingIcon size={12} />}
					<span
						className={cn(
							"max-w-[140px] truncate font-sans text-xs font-light leading-4 text-muted-foreground",
							(!relativePath || showDeletedStatus) && "hidden",
						)}
					>
						{relativePath}
					</span>
					{showDeletedStatus && (
						<span className="flex items-center gap-1 font-sans text-xs font-normal leading-4 text-destructive">
							{t("fileViewer.tabs.deleted")}
							<MagicIcon component={IconLock} size={14} color="currentColor" />
						</span>
					)}
					{tab.closeable ? (
						<div
							className={cn(
								"flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground transition-colors duration-200 hover:bg-black/10",
								isActive && "text-foreground/80",
							)}
							onClick={handleClose}
							draggable={false}
							onPointerDown={(event) => {
								event.stopPropagation()
								event.preventDefault()
							}}
							onDragStart={(event) => event.preventDefault()}
							data-tab-close
							data-testid="handle-close"
						>
							<IconX size={12} />
						</div>
					) : null}
				</div>
			</Tooltip>
		)
	},
)

TabItem.displayName = "TabItem"

export default TabItem
