import {
	memo,
	useRef,
	useImperativeHandle,
	forwardRef,
	useState,
	useEffect,
	useMemo,
	useCallback,
} from "react"
import { observer } from "mobx-react-lite"
import { IconMenu2, IconX } from "@tabler/icons-react"
import { Tooltip } from "antd"
import { cn } from "@/lib/utils"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"

// Types
import type { FilesViewerProps, FilesViewerRef, TabItem as TabItemType } from "./types"

// Hooks
import { useFilesViewer } from "./hooks/useFilesViewer"
import { useTabContextMenu } from "./hooks/useTabContextMenu"
import { useTabCache } from "./hooks/useTabCache"

// Components
import TabCache from "./components/TabCache"
import TabItem from "./components/TabItem"
import { TabContextMenu } from "./components/TabContextMenu"
import { useTranslation } from "react-i18next"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import MagicIcon from "@/components/base/MagicIcon"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import DetailEmpty from "../DetailEmpty"
import { getAttachmentExtension } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"

// 获取文件路径用作tooltip的工具函数
const getFileTooltip = (tab: any, unknownFileText: string) => {
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
 * FilesViewer - 文件标签页查看器组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const FilesViewer = memo(
	observer(
		forwardRef<FilesViewerRef, FilesViewerProps>((props, ref) => {
			// Props are passed directly to hook
			const { t } = useTranslation("super")
			const [expandPanelVisible, setExpandPanelVisible] = useState(false)
			const expandButtonRef = useRef<HTMLDivElement>(null)
			const tabsContainerRef = useRef<HTMLDivElement>(null)

			// 使用自定义 Hook 管理状态
			const {
				tabs,
				activeTab,
				openFileTab,
				closeFileTab,
				switchToTab,
				clearAllTabs,
				closeOtherTabs,
				closeTabsToRight,
				getRenderProps,
				fullscreenFileId,
				handleRefresh,
				handleTabDragStart,
				handleTabDragEnd,
				handleTabDragOver,
				handleTabDrop,
				draggedTab,
				dragOverIndex,
				dragDirection,
				openPlaybackTab,
				closePlaybackTab,
				isPlaybackTab,
				handleFileFullscreen,
				handleExitFullscreen,
				getCheckBeforeClose,
			} = useFilesViewer(props)

			// 使用缓存 Hook
			const {
				addToCache,
				getFromCache,
				removeFromCache,
				clearCache,
				getCacheStats,
				cachedTabIds,
			} = useTabCache({
				maxCacheSize: 10,
				enableCache: true,
				cacheOfficeFiles: true,
			})

			// -----------------注册快捷键-----------------

			// 与系统快捷键冲突，暂时禁用
			// useRegisterShortcut(ShortcutActions.CLOSE_CURRENT_TAB, () => {
			// 	if (activeTab) {
			// 		closeFileTab(activeTab.id)
			// 	}
			// })

			// 暂时禁用
			// useRegisterShortcut(ShortcutActions.CLOSE_OTHER_TABS, () => {
			// 	if (activeTab) {
			// 		closeOtherTabs(activeTab.id)
			// 	}
			// })

			// 与系统快捷键冲突，暂时禁用
			// useRegisterShortcut(ShortcutActions.CLOSE_ALL_TABS, () => {
			// 	clearAllTabs()
			// })
			// -----------------注册快捷键-----------------

			// 处理 tab 关闭时的缓存清理
			const handleTabClose = async (tabId: string) => {
				// Get checkBeforeClose function for this tab/file
				const checkBeforeClose = getCheckBeforeClose(tabId)

				// If tab has checkBeforeClose method, call it first
				if (checkBeforeClose && typeof checkBeforeClose === "function") {
					const canClose = await checkBeforeClose()
					if (!canClose) {
						// User canceled the close operation
						return
					}
				}

				closeFileTab(tabId)
				removeFromCache(tabId)
			}

			// 处理所有 tabs 关闭时的缓存清理
			const handleClearAllTabs = async () => {
				// Check if any tab has unsaved changes
				for (const tab of tabs) {
					const checkBeforeClose = getCheckBeforeClose(tab.id)

					if (checkBeforeClose && typeof checkBeforeClose === "function") {
						const canClose = await checkBeforeClose()
						if (!canClose) {
							// User canceled the operation
							return
						}
					}
				}

				clearAllTabs()
				clearCache()
			}

			// Handle refresh tab action
			const handleRefreshTab = useCallback(
				(tabId: string) => {
					// Switch to the tab first if it's not active
					if (activeTab?.id !== tabId) {
						switchToTab(tabId)
					}
					// Trigger refresh after a short delay to ensure tab is active
					setTimeout(() => {
						handleRefresh()
					}, 100)
				},
				[activeTab, switchToTab, handleRefresh],
			)

			// 使用右键菜单 Hook
			const {
				contextMenuState,
				handleContainerContextMenu,
				getContextMenuItems,
				hideContextMenu,
			} = useTabContextMenu({
				tabs,
				actions: {
					closeFileTab: handleTabClose,
					closeOtherTabs,
					closeTabsToRight,
					clearAllTabs: handleClearAllTabs,
					refreshTab: handleRefreshTab,
				},
			})

			// 暴露组件方法
			useImperativeHandle(ref, () => ({
				openFileTab,
				closeFileTab,
				switchToTab,
				clearAllTabs,
				closeOtherTabs,
				closeTabsToRight,
				isFullscreen: !!fullscreenFileId,
				// 暴露缓存相关方法
				getCacheStats,
				clearCache,
				handleRefresh,
				// Playback tab相关方法
				openPlaybackTab,
				closePlaybackTab,
			}))

			// Notify parent about fullscreen state changes via callback
			useEffect(() => {
				props.onFullscreenChange?.(!!fullscreenFileId)
			}, [fullscreenFileId, props])

			// 监听activeTab变化，自动滚动到对应位置
			useEffect(() => {
				if (!activeTab || !tabsContainerRef.current || tabs.length === 0) return

				const container = tabsContainerRef.current
				const activeTabElement = container.querySelector(
					`[data-tab-id="${activeTab.id}"]`,
				) as HTMLElement

				if (activeTabElement) {
					// 计算目标tab相对于容器的位置
					const targetScrollLeft =
						activeTabElement.offsetLeft -
						container.offsetWidth / 2 +
						activeTabElement.offsetWidth / 2

					// 平滑滚动到目标位置
					container.scrollTo({
						left: Math.max(0, targetScrollLeft),
						behavior: "smooth",
					})
				}
			}, [activeTab, tabs])

			// 处理展开按钮点击
			const handleExpandClick = () => {
				setExpandPanelVisible(!expandPanelVisible)
			}

			// 渲染tab项
			const renderTabItem = (tab: TabItemType, index: number) => {
				const isActive = activeTab?.id === tab.id
				const isDragging = draggedTab?.id === tab.id
				const isDragOver = dragOverIndex === index
				const isPlayback = isPlaybackTab(tab.id)

				return (
					<TabItem
						key={tab.id}
						tab={tab}
						index={index}
						allTabs={tabs}
						isActive={isActive}
						isDragging={isDragging}
						isDragOver={isDragOver}
						dragDirection={dragDirection || undefined}
						isPlayback={isPlayback}
						contextMenuState={contextMenuState}
						onSwitchToTab={switchToTab}
						onCloseTab={handleTabClose}
						onDragStart={handleTabDragStart}
						onDragEnd={handleTabDragEnd}
						onDragOver={handleTabDragOver}
						onDrop={handleTabDrop}
					/>
				)
			}

			// 渲染展开面板项
			const renderExpandPanelItem = (tab: any) => {
				const isPlayback = isPlaybackTab(tab.id)
				return (
					<Tooltip
						title={getFileTooltip(tab, t("fileViewer.unknownFile"))}
						placement="right"
						mouseEnterDelay={0.3}
						classNames={{
							root: "max-w-[500px]",
						}}
					>
						<div
							key={tab.id}
							className="flex cursor-pointer items-center gap-1 rounded px-[10px] py-[6px] transition-colors duration-200 hover:bg-black/5"
							onClick={() => {
								switchToTab(tab.id)
								setExpandPanelVisible(false)
							}}
						>
							<MagicFileIcon
								type={
									isPlayback
										? "replay"
										: getAttachmentExtension(tab?.fileData?.metadata) ||
										tab.fileData?.file_extension ||
										""
								}
								size={12}
							/>
							<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-sans text-xs font-normal leading-[1.33] text-foreground/80">
								{tab.title || tab.name}
							</span>
							<div
								className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded transition-colors duration-200 hover:bg-black/10"
								onClick={(e) => {
									e.stopPropagation()
									handleTabClose(tab.id)
								}}
							>
								<IconX />
							</div>
						</div>
					</Tooltip>
				)
			}

			const currentTab = activeTab
			const { isFullscreen, ...otherProps } = getRenderProps(currentTab)
			const shouldShowDetailEmpty =
				props.showFallbackWhenEmpty ||
				(!currentTab && (tabs.length > 0 || Boolean(props.activeFileId)))

			// 缓存当前 tab 的渲染属性
			useEffect(() => {
				if (currentTab) {
					addToCache(currentTab.id, { isFullscreen, ...otherProps })
				}
			}, [currentTab?.id, isFullscreen, JSON.stringify(otherProps), addToCache])

			// 判断是否应该渲染某个 tab
			const shouldRenderTab = useCallback(
				(tab: any) => {
					const isActive = activeTab?.id === tab.id
					const isCached = cachedTabIds.includes(tab.id)

					// 只渲染活跃的 tab 和缓存中的 tab
					return isActive || isCached
				},
				[activeTab?.id, cachedTabIds],
			)

			// 渲染活跃和缓存的 tabs
			const renderCachedTabs = useMemo(() => {
				const filteredTabs = tabs.filter(shouldRenderTab)

				return filteredTabs.map((tab) => {
					const isActive = activeTab?.id === tab.id
					const cachedProps = getFromCache(tab.id)

					// 如果没有缓存，使用当前 tab 的属性
					const renderProps = cachedProps || { isFullscreen, ...otherProps }

					// 判断是否是演示模式tab，如果是则构建playbackProps
					const isPlayback = isPlaybackTab(tab.id)
					const playbackProps = isPlayback
						? {
							disPlayDetail: props.userSelectDetail || props.autoDetail,
							setUserSelectDetail: props.setUserSelectDetail,
							userSelectDetail: props.userSelectDetail,
							attachments: props.attachments,
							attachmentList: props.attachmentList,
							topicId: props.topicId,
							baseShareUrl: props.baseShareUrl,
							currentTopicStatus: props.currentTopicStatus,
							messages: props.messages,
							autoDetail: props.autoDetail,
							showPlaybackControl: props.showPlaybackControl,
							allowEdit: props.allowEdit,
							selectedTopic: props.selectedTopic,
							selectedProject: props.selectedProject,
							isFileShare: props.isFileShare,
							activeFileId: props.activeFileId,
							onActiveFileChange: props.onActiveFileChange,
							openFileTab: props.openFileTab,
							getFileViewMode: props.getFileViewMode,
							handleViewModeChange: props.handleViewModeChange,
							onDownload: props.onDownload,
							isFullscreen: fullscreenFileId === tab.id,
							onFullscreenChange: (fs: boolean) => {
								if (fs) {
									handleFileFullscreen(tab.id)
								} else {
									handleExitFullscreen()
								}
							},
						}
						: undefined

					return (
						<TabCache
							key={tab.id}
							tab={tab as any}
							isActive={isActive}
							renderProps={renderProps}
							onActiveFileChange={props?.onActiveFileChange}
							isFullscreen={isFullscreen}
							openFileTab={openFileTab}
							playbackProps={playbackProps}
						/>
					)
				})
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [
				tabs,
				activeTab?.id,
				getFromCache,
				isFullscreen,
				otherProps,
				props?.onActiveFileChange,
				shouldRenderTab,
				cachedTabIds,
				isPlaybackTab,
				props,
				props.autoDetail,
				props.userSelectDetail,
				openFileTab,
			])

			return (
				<div
					className={cn(
						"flex h-full flex-col",
						isFullscreen &&
						"fixed inset-0 z-[1022] h-screen w-screen rounded-none bg-white",
					)}
				>
					{/* Tab Bar */}
					{tabs.length > 0 && (
						<div className="relative flex h-9 items-center bg-accent">
							<HeadlessHorizontalScroll
								className="h-full min-w-0 flex-1"
								controlBackground="rgb(var(--accent-rgb))"
								scrollContainerClassName="no-scrollbar flex h-full w-full items-center overflow-x-auto overflow-y-hidden px-1"
								scrollContainerRef={tabsContainerRef}
								onScrollContainerContextMenu={handleContainerContextMenu}
							>
								{tabs.map((tab, index) => renderTabItem(tab, index))}
							</HeadlessHorizontalScroll>

							{/* 展开按钮 */}
							<DropdownMenu
								open={expandPanelVisible}
								onOpenChange={setExpandPanelVisible}
							>
								<DropdownMenuTrigger asChild>
									<div
										className="relative mx-1 flex size-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-md transition-all duration-200 hover:bg-black/10"
										ref={expandButtonRef}
									>
										<MagicIcon
											component={IconMenu2}
											onClick={handleExpandClick}
											size={18}
										/>
									</div>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="max-h-[300px] w-[180px] overflow-y-auto p-1"
								>
									{tabs.map(renderExpandPanelItem)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}

					{/* 右键菜单 */}
					<TabContextMenu
						contextMenuState={contextMenuState}
						getContextMenuItems={getContextMenuItems}
						onClose={hideContextMenu}
					/>

					{/* Content Area */}
					<div className="flex flex-1 flex-col overflow-hidden">
						{currentTab ? (
							<>
								{/* 渲染所有缓存的 tabs */}
								{renderCachedTabs}
							</>
						) : shouldShowDetailEmpty ? (
							<DetailEmpty />
						) : null}
					</div>
				</div>
			)
		}),
	),
)

FilesViewer.displayName = "FilesViewer"

export default FilesViewer

// Export ref type for external usage
export type { FilesViewerRef }
