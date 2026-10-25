import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
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
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import userFilesStore from "@/stores/userFiles"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import { IconMenu2, IconX } from "@tabler/icons-react"
import { FolderTree } from "lucide-react"
import { clipboard } from "@/utils/clipboard-helpers"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useFileInfoPanel } from "../../../TopicFilesButton/hooks/useFileInfoPanel"
import { copyAttachmentPath } from "../../../TopicFilesButton/utils/attachmentPath"
import { Tooltip } from "antd"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/utils/cn"
import useFullscreenMode from "@/hooks/useFullscreenMode"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"

// Types
import type { FilesViewerProps, FilesViewerRef, TabItem as TabItemType } from "./types"

// Hooks
import { useFilesViewer } from "./hooks/useFilesViewer"
import { useTabDrag } from "./hooks/useTabDrag"
import { useTabContextMenu } from "./hooks/useTabContextMenu"
import { useTabCache } from "./hooks/useTabCache"

// Components
import TabCache from "./components/TabCache"
import TabItem from "./components/TabItem"
import { TabContextMenu } from "./components/TabContextMenu"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import MagicSpin from "@/components/base/MagicSpin"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import DetailEmpty from "../DetailEmpty"
import { FileTabMagicIcon } from "./components/FileTabMagicIcon"
import WebsitePresetMenu from "./components/WebsitePresetMenu"
import CommonWebsitePresetDialog, {
	type CommonWebsitePresetFormValues,
} from "./components/CommonWebsitePresetDialog"
import StablePreviewPortalSurface from "./components/StablePreviewPortalSurface"
import {
	COMMON_WEBSITE_PRESETS_LIMIT,
	getWebsiteTabData,
	saveCommonWebsitePreset,
} from "./utils/websiteTabs"
import {
	FILE_VIEWER_DOCUMENT_FLOW_FULLSCREEN_VIEWPORT_CLASS_NAME,
	FILE_VIEWER_FULLSCREEN_SAFE_AREA_CLASS_NAME,
	FILE_VIEWER_FULLSCREEN_VIEWPORT_CLASS_NAME,
	shouldUseFileViewerFullscreenSafeArea,
} from "./utils/fullscreenSafeArea"
import { PLAYBACK_TAB_ID } from "./utils/tabConstants"
import { shouldUsePPTRootRender } from "../../utils/file"

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
			const tabAttachments = props.attachments ?? props.attachmentList
			const ownerId = props.selectedProject?.id ?? props.projectId
			const fileHelpContext = useMemo<FileHelpContext>(
				() =>
					props.fileHelpContext ??
					(ownerId
						? { kind: "project", projectId: String(ownerId) }
						: { kind: "unknown" }),
				[props.fileHelpContext, ownerId],
			)
			const { t } = useTranslation("super")
			const isUrlFullscreenMode = useFullscreenMode()
			const isFullscreenMode = Boolean(props.forceFullscreenMode) || isUrlFullscreenMode
			const [expandPanelVisible, setExpandPanelVisible] = useState(false)
			const [commonWebsiteDialogOpen, setCommonWebsiteDialogOpen] = useState(false)
			const [commonWebsiteInitialValues, setCommonWebsiteInitialValues] =
				useState<CommonWebsitePresetFormValues>()
			const tabsContainerRef = useRef<HTMLDivElement>(null)

			// 使用自定义 Hook 管理状态
			const {
				tabs,
				activeTab,
				isRestoringFileTabs,
				isAwaitingProjectAttachments,
				openFileTab,
				openWebsiteTab,
				closeFileTab: closeFileTabState,
				switchToTab,
				clearAllTabs: clearAllTabsState,
				closeOtherTabs: closeOtherTabsState,
				closeTabsToRight: closeTabsToRightState,
				getRenderProps,
				fullscreenFileId,
				handleRefresh,
				reorderTabs,
				openPlaybackTab,
				closePlaybackTab,
				isPlaybackTab,
				openKnowledgeBaseTab,
				closeKnowledgeBaseTab,
				isKnowledgeBaseTab,
				openMicroAppTab,
				closeMicroAppTab,
				isPublishedMicroAppTab,
				handleFileFullscreen,
				handleExitFullscreen,
				enterPreviewFullscreen,
				exitPreviewFullscreen,
				getCheckBeforeClose,
				getTabFileContext,
				getFileManagerState,
				updateFileManagerState,
				isShareRoute,
				isMagicShareRoute,
			} = useFilesViewer(props)
			// Route state covers topic/pure/Magic shares; the prop covers file-share callers during setup.
			const shouldRenderQuickOpen = !isShareRoute && !isMagicShareRoute && !props.isFileShare
			const tabsRef = useRef(tabs)
			tabsRef.current = tabs
			const closingBatchTabsRef = useRef(false)
			const { handleShowInfo, fileInfoPanel } = useFileInfoPanel()

			const handleFileInfo = (tabId: string) => {
				const context = getTabFileContext(tabId)
				if (context?.canShowInfo) handleShowInfo(context.item)
			}
			const handleCopyFileName = async (tabId: string) => {
				const context = getTabFileContext(tabId)
				if (!context?.fileName) return
				try {
					await clipboard.writeText(context.fileName)
					magicToast.success(t("fileViewer.tabs.copyFileNameSuccess"))
				} catch {
					magicToast.error(t("fileViewer.tabs.copyFileNameFailed"))
				}
			}
			const handleCopyFilePath = async (tabId: string) => {
				const context = getTabFileContext(tabId)
				if (context?.canCopyPath) await copyAttachmentPath({ item: context.item, t })
			}
			const handleLocateFile = (tabId: string) => {
				const context = getTabFileContext(tabId)
				if (context?.canLocate) {
					pubsub.publish(PubSubEvents.Locate_File_In_Tree, context.item.file_id)
				}
			}
			const { isDragging, handleDragStart, handleDragEnd } = useTabDrag({
				tabs,
				containerRef: tabsContainerRef,
				onReorder: reorderTabs,
			})

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

			const confirmTabClosures = async (tabIds: string[]) => {
				for (const tabId of tabIds) {
					const tab = tabsRef.current.find((candidate) => candidate.id === tabId)
					if (!tab || tab.closeable === false) continue

					const checkBeforeClose = getCheckBeforeClose(tabId)
					if (checkBeforeClose && !(await checkBeforeClose())) return false
				}
				return true
			}

			const runConfirmedTabClose = async (options: {
				tabIds: string[]
				close: () => void
				isStillValid?: () => boolean
				clearCacheAfter?: boolean
			}) => {
				if (closingBatchTabsRef.current) return false
				closingBatchTabsRef.current = true
				try {
					if (!(await confirmTabClosures(options.tabIds))) return false
					if (options.isStillValid && !options.isStillValid()) return false

					options.close()
					if (options.clearCacheAfter) clearCache()
					return true
				} finally {
					closingBatchTabsRef.current = false
				}
			}

			// 处理 tab 关闭时的缓存清理
			const handleTabClose = async (tabId: string) => {
				await runConfirmedTabClose({
					tabIds: [tabId],
					close: () => {
						closeFileTabState(tabId)
						removeFromCache(tabId)
					},
				})
			}

			// 处理所有 tabs 关闭时的缓存清理
			const handleClearAllTabs = async () => {
				const candidates = tabsRef.current
					.filter((tab) => tab.closeable !== false)
					.map((tab) => tab.id)
				await runConfirmedTabClose({
					tabIds: candidates,
					close: clearAllTabsState,
					clearCacheAfter: true,
				})
			}

			const handleCloseTabsToLeft = async (tabId: string) => {
				if (closingBatchTabsRef.current) return
				const targetIndex = tabsRef.current.findIndex((tab) => tab.id === tabId)
				if (targetIndex <= 0) return
				const candidates = tabsRef.current
					.slice(0, targetIndex)
					.filter((tab) => tab.closeable !== false)
					.map((tab) => tab.id)
				if (candidates.length === 0) return
				try {
					// 先完成这一批的编辑确认；取消时不关闭前面已确认的标签。
					await runConfirmedTabClose({
						tabIds: candidates,
						isStillValid: () => tabsRef.current.some((tab) => tab.id === tabId),
						close: () => {
							for (const candidateId of candidates) {
								closeFileTabState(candidateId)
								removeFromCache(candidateId)
							}
							switchToTab(tabId)
						},
					})
				} catch {
					magicToast.error(t("fileViewer.tabs.closeFailed"))
				}
			}

			const handleCloseOtherTabs = async (tabId: string) => {
				if (closingBatchTabsRef.current) return
				const candidates =
					tabId === PLAYBACK_TAB_ID
						? tabsRef.current
								.filter((tab) => tab.closeable !== false)
								.map((tab) => tab.id)
						: tabsRef.current
								.filter((tab) => tab.id !== tabId && tab.closeable !== false)
								.map((tab) => tab.id)
				await runConfirmedTabClose({
					tabIds: candidates,
					isStillValid: () =>
						tabId === PLAYBACK_TAB_ID ||
						tabsRef.current.some((tab) => tab.id === tabId),
					close: () => {
						closeOtherTabsState(tabId)
						for (const candidateId of candidates) removeFromCache(candidateId)
					},
				})
			}

			const handleCloseTabsToRight = async (tabId: string) => {
				if (closingBatchTabsRef.current) return
				const targetIndex = tabsRef.current.findIndex((tab) => tab.id === tabId)
				const candidates =
					tabId === PLAYBACK_TAB_ID
						? tabsRef.current
								.filter((tab) => tab.closeable !== false)
								.map((tab) => tab.id)
						: targetIndex < 0
							? []
							: tabsRef.current
									.slice(targetIndex + 1)
									.filter((tab) => tab.closeable !== false)
									.map((tab) => tab.id)
				if (candidates.length === 0) return
				await runConfirmedTabClose({
					tabIds: candidates,
					isStillValid: () =>
						tabId === PLAYBACK_TAB_ID ||
						tabsRef.current.some((tab) => tab.id === tabId),
					close: () => {
						closeTabsToRightState(tabId)
						for (const candidateId of candidates) removeFromCache(candidateId)
					},
				})
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

			const handleAddWebsiteToCommon = useCallback((tab: TabItemType) => {
				const tabData = getWebsiteTabData(tab)
				setCommonWebsiteInitialValues({
					title: tabData.title,
					url: tabData.url,
					description: tabData.description,
				})
				setCommonWebsiteDialogOpen(true)
			}, [])

			const handleSubmitCommonWebsite = useCallback(
				(values: CommonWebsitePresetFormValues) => {
					const result = saveCommonWebsitePreset(values)
					if (result.status === "saved") {
						magicToast.success(t("fileViewer.website.commonSaved"))
						setCommonWebsiteDialogOpen(false)
						return
					}
					if (result.status === "limit") {
						magicToast.warning(
							t("fileViewer.website.commonLimitReached", {
								count: COMMON_WEBSITE_PRESETS_LIMIT,
							}),
						)
						return
					}
					if (result.status === "exists") {
						magicToast.warning(t("fileViewer.website.commonAlreadyExists"))
						return
					}
					magicToast.warning(t("fileViewer.website.commonSaveFailed"))
				},
				[t],
			)

			// 使用右键菜单 Hook
			const {
				contextMenuState,
				handleContainerContextMenu,
				getContextMenuItems,
				hideContextMenu,
			} = useTabContextMenu({
				tabs,
				getFileContext: getTabFileContext,
				actions: {
					closeFileTab: handleTabClose,
					closeOtherTabs: handleCloseOtherTabs,
					closeTabsToLeft: handleCloseTabsToLeft,
					closeTabsToRight: handleCloseTabsToRight,
					clearAllTabs: handleClearAllTabs,
					refreshTab: handleRefreshTab,
					addWebsiteToCommon: handleAddWebsiteToCommon,
					showFileInfo: handleFileInfo,
					copyFileName: handleCopyFileName,
					copyFilePath: handleCopyFilePath,
					locateFile: handleLocateFile,
				},
			})

			const handlePreviewCollapse = () => {
				setExpandPanelVisible(false)
				hideContextMenu()
				props.onPreviewCollapse?.()
			}

			// 暴露组件方法
			useImperativeHandle(ref, () => ({
				openFileTab,
				closeFileTab: handleTabClose,
				switchToTab,
				clearAllTabs: handleClearAllTabs,
				closeOtherTabs: handleCloseOtherTabs,
				closeTabsToRight: handleCloseTabsToRight,
				isFullscreen: !!fullscreenFileId,
				// 暴露缓存相关方法
				getCacheStats,
				clearCache,
				handleRefresh,
				// Playback tab相关方法
				openPlaybackTab,
				closePlaybackTab,
				// Knowledge base tab相关方法
				openKnowledgeBaseTab,
				closeKnowledgeBaseTab,
				openMicroAppTab,
				closeMicroAppTab,
				enterPreviewFullscreen,
				exitPreviewFullscreen,
				// Website tab相关方法
				openWebsiteTab,
			}))

			// Notify parent about fullscreen state changes via callback
			useEffect(() => {
				props.onFullscreenChange?.(Boolean(props.forceFullscreenMode) || !!fullscreenFileId)
			}, [fullscreenFileId, props.forceFullscreenMode, props.onFullscreenChange])

			// 监听activeTab变化，自动滚动到对应位置
			useEffect(() => {
				if (!activeTab || !tabsContainerRef.current || tabs.length === 0) return

				const container = tabsContainerRef.current
				// Tab ids may contain file-path characters that are invalid inside CSS selectors.
				const activeTabElement = Array.from(
					container.querySelectorAll<HTMLElement>("[data-tab-id]"),
				).find((element) => element.dataset.tabId === activeTab?.id)

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
			}, [activeTab?.id, tabs.length])

			// 渲染tab项
			const renderTabItem = (tab: TabItemType) => {
				const isActive = activeTab?.id === tab.id
				const isPlayback = isPlaybackTab(tab.id)

				return (
					<TabItem
						key={tab.id}
						tab={tab}
						allTabs={tabs}
						isActive={isActive}
						isDragging={isDragging}
						isPlayback={isPlayback}
						contextMenuState={contextMenuState}
						attachments={tabAttachments}
						context={fileHelpContext}
						onSwitchToTab={switchToTab}
						onCloseTab={handleTabClose}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					/>
				)
			}

			// 渲染展开面板项
			const renderExpandPanelItem = (tab: any) => {
				const isPlayback = isPlaybackTab(tab.id)
				return (
					<Tooltip
						key={tab.id}
						title={getFileTooltip(tab, t("fileViewer.unknownFile"))}
						placement="right"
						mouseEnterDelay={0.3}
						classNames={{
							root: "max-w-[500px]",
						}}
					>
						<div
							className="flex cursor-pointer items-center gap-1 rounded px-[10px] py-[6px] transition-colors duration-200 hover:bg-black/5"
							onClick={() => {
								switchToTab(tab.id)
								setExpandPanelVisible(false)
							}}
							data-testid="switch-to-tab"
						>
							<FileTabMagicIcon
								tab={tab}
								attachments={tabAttachments}
								context={fileHelpContext}
								isPlayback={isPlayback}
								size={12}
							/>
							<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-sans text-xs font-normal leading-[1.33] text-foreground/80">
								{tab.title || tab.name}
							</span>
							{tab.closeable ? (
								<div
									className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded transition-colors duration-200 hover:bg-black/10"
									onClick={(e) => {
										e.stopPropagation()
										handleTabClose(tab.id)
									}}
									data-testid="handle-tab-close"
								>
									<IconX />
								</div>
							) : null}
						</div>
					</Tooltip>
				)
			}

			const currentTab = activeTab
			const { isFullscreen, ...otherProps } = getRenderProps(currentTab)
			const effectiveIsFullscreen =
				isFullscreenMode || Boolean(isFullscreen) || fullscreenFileId === currentTab?.id
			const isDocumentFlowFullscreen =
				Boolean(props.documentFlowFullscreen) && effectiveIsFullscreen
			const currentRenderProps = useMemo(
				() => ({
					isFullscreen: effectiveIsFullscreen,
					documentFlowFullscreen: isDocumentFlowFullscreen,
					...otherProps,
				}),
				[effectiveIsFullscreen, isDocumentFlowFullscreen, otherProps],
			)
			const fileSidebarButton = props.fileSidebarControl?.isCollapsed ? (
				<Tooltip
					title={t("sidebarPanels.expandFiles")}
					placement="bottom"
					trigger={["hover", "focus"]}
				>
					<button
						ref={props.fileSidebarControl.triggerRef}
						type="button"
						className="mx-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-background shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
						onClick={props.fileSidebarControl.onToggle}
						aria-label={t("sidebarPanels.expandFiles")}
						data-testid="file-viewer-expand-files"
					>
						<FolderTree size={16} />
					</button>
				</Tooltip>
			) : null

			const shouldUseSafeAreaFullscreen = shouldUseFileViewerFullscreenSafeArea()
			const currentRenderPropsRef = useRef(currentRenderProps)
			currentRenderPropsRef.current = currentRenderProps
			const currentTabId = currentTab?.id
			const currentRenderCacheKey = useMemo(() => {
				if (!currentTab) return ""

				return [
					currentTab.id,
					("refreshKey" in currentTab && currentTab.refreshKey) || "",
					currentTab.fileData.file_id || "",
					currentTab.fileData.updated_at || "",
					String(effectiveIsFullscreen),
					String(isDocumentFlowFullscreen),
					String(otherProps.type || ""),
					String(otherProps.updatedAt || ""),
					currentTab.fileData.htmlNavigation?.filePath || "",
					currentTab.fileData.htmlNavigation?.search || "",
					currentTab.fileData.htmlNavigation?.hash || "",
					currentTab.fileData.htmlNavigation?.anchor || "",
					props.activeFileId || "",
					props.attachmentLoadState?.projectId || "",
					props.attachmentLoadState?.status || "",
					props.showFileFooter ? "1" : "0",
				].join("|")
			}, [
				currentTab,
				effectiveIsFullscreen,
				isDocumentFlowFullscreen,
				otherProps.type,
				otherProps.updatedAt,
				currentTab?.fileData.htmlNavigation?.filePath,
				currentTab?.fileData.htmlNavigation?.search,
				currentTab?.fileData.htmlNavigation?.hash,
				currentTab?.fileData.htmlNavigation?.anchor,
				props.activeFileId,
				props.attachmentLoadState?.projectId,
				props.attachmentLoadState?.status,
				props.showFileFooter,
			])
			const shouldShowDetailEmpty =
				props.showFallbackWhenEmpty ||
				(!currentTab && (tabs.length > 0 || Boolean(props.activeFileId)))
			const hasCloseableTabs = tabs.some((tab) => tab.closeable !== false)

			// 缓存当前 tab 的渲染属性
			useEffect(() => {
				if (currentTabId) {
					addToCache(currentTabId, currentRenderPropsRef.current)
				}
			}, [currentTabId, currentRenderCacheKey, addToCache])

			const editingUserFiles = [...userFilesStore.editingFileIds].join(":")
			const editingUserFileIds = useMemo(
				() => new Set(editingUserFiles.split(":")),
				[editingUserFiles],
			)

			// 判断是否应该渲染某个 tab
			const shouldRenderTab = useCallback(
				(tab: any) => {
					const isActive = activeTab?.id === tab.id
					const isCached = cachedTabIds.includes(tab.id)

					// 只渲染活跃的 tab 和缓存中的 tab
					return (
						isActive ||
						isCached ||
						(tab.fileData.space_type === "user" &&
							editingUserFileIds.has(tab.fileData.file_id))
					)
				},
				[activeTab?.id, cachedTabIds, editingUserFileIds],
			)

			// 每个 Tab 只生成一个 TabCache。非文档流模式统一放入稳定 body Portal，
			// 文档流模式统一保留在当前文档树中，避免同一 Tab 同时出现在两条渲染链路。
			const cachedTabRenders = useMemo(() => {
				const filteredTabs = tabs.filter(shouldRenderTab)

				return filteredTabs.map((tab) => {
					const isActive = activeTab?.id === tab.id
					const cachedProps = getFromCache(tab.id)

					// 如果没有缓存，使用当前 tab 的属性
					const renderProps =
						tab.fileData.space_type === "user"
							? {
									...getRenderProps(tab),
									isFullscreen: effectiveIsFullscreen,
									documentFlowFullscreen: isDocumentFlowFullscreen,
								}
							: isActive
								? currentRenderProps
								: cachedProps || currentRenderProps

					// 判断是否是演示模式tab，如果是则构建playbackProps
					const isPlayback = isPlaybackTab(tab.id)
					const playbackProps = isPlayback
						? {
								disPlayDetail: props.userSelectDetail || props.autoDetail,
								setUserSelectDetail: props.setUserSelectDetail,
								userSelectDetail: props.userSelectDetail,
								attachments: props.attachments,
								attachmentList: props.attachmentList,
								isAwaitingProjectAttachments,
								topicId: props.topicId,
								baseShareUrl: props.baseShareUrl,
								currentTopicStatus: props.currentTopicStatus,
								messages: props.messages,
								autoDetail: props.autoDetail,
								showPlaybackControl: props.showPlaybackControl,
								allowEdit: props.allowEdit,
								selectedTopic: props.selectedTopic,
								selectedProject: props.selectedProject,
								projectId: props.projectId,
								isFileShare: props.isFileShare,
								activeFileId: props.activeFileId,
								onActiveFileChange: props.onActiveFileChange,
								openFileTab: props.openFileTab
									? (fileId: string, path: string) =>
											props.openFileTab?.({
												file_id: fileId,
												relative_file_path: path,
											})
									: undefined,
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

					// 判断是否是知识库tab
					const isKbTab = isKnowledgeBaseTab(tab.id)
					const knowledgeBaseData = isKbTab ? (tab as any).data : undefined
					const isMicroAppTab = isPublishedMicroAppTab(tab.id)
					const microAppData = isMicroAppTab ? (tab as any).data : undefined
					return {
						isActive,
						node: (
							<TabCache
								onOpenProjectRecycle={(projectId) =>
									openFileTab({
										file_manager: {
											spaceType: "project",
											projectId,
											area: "recycle",
										},
									})
								}
								getFileManagerState={getFileManagerState}
								onFileManagerStateChange={updateFileManagerState}
								managerProps={{
									projectFilesStore: props.projectFilesStore,
									attachments: (props.attachments ?? []) as AttachmentItem[],
									selectedProject: props.selectedProject,
									selectedTopic: props.selectedTopic,
									allowEdit: props.allowEdit,
									allowDownload: props.allowDownload,
									loading: isAwaitingProjectAttachments,
									attachmentLoadState: props.attachmentLoadState,
									onFileClick: openFileTab,
									onPreviewFile: (file, activate) =>
										openFileTab(file, false, activate),
									onPreviewRemoved: (ids) => {
										const tabIds = ids.map((id) => `recycle-bin:${id}`)
										// 一批恢复共用关闭确认，避免单项并发关闭被批次锁跳过。
										void runConfirmedTabClose({
											tabIds,
											close: () =>
												tabIds.forEach((id) => {
													closeFileTabState(id)
													removeFromCache(id)
												}),
										})
									},
								}}
								key={tab.id}
								tab={tab as any}
								isActive={isActive}
								renderProps={renderProps}
								onActiveFileChange={props?.onActiveFileChange}
								isFullscreen={effectiveIsFullscreen}
								documentFlowFullscreen={isDocumentFlowFullscreen}
								openFileTab={openFileTab}
								playbackProps={playbackProps}
								hideTabBar={props.hideTabBar}
								knowledgeBaseData={knowledgeBaseData}
								microAppData={microAppData}
								fillPortalSurface={!isDocumentFlowFullscreen}
								onCloseTab={handleTabClose}
							/>
						),
					}
				})
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [
				tabs,
				activeTab?.id,
				getFromCache,
				effectiveIsFullscreen,
				isDocumentFlowFullscreen,
				currentRenderProps,
				props?.onActiveFileChange,
				shouldRenderTab,
				cachedTabIds,
				isPlaybackTab,
				isKnowledgeBaseTab,
				isPublishedMicroAppTab,
				props,
				props.autoDetail,
				props.userSelectDetail,
				openFileTab,
				handleTabClose,
			])
			const inlineCachedTabs = cachedTabRenders
				.filter(() => isDocumentFlowFullscreen)
				.map((entry) => entry.node)
			const stableCachedTabs = cachedTabRenders
				.filter(() => !isDocumentFlowFullscreen)
				.map((entry) => entry.node)
			const hasStableTabs = stableCachedTabs.length > 0
			const hasActiveStableTab =
				Boolean(currentTab) && !isDocumentFlowFullscreen && !isRestoringFileTabs
			const isActivePptPreview = Boolean(
				currentTab &&
				shouldUsePPTRootRender(currentRenderProps.type, currentRenderProps.data),
			)
			const [stablePreviewSurfaceAnchor, setStablePreviewSurfaceAnchor] =
				useState<HTMLDivElement | null>(null)

			const viewer = (
				<div
					className={cn(
						isDocumentFlowFullscreen
							? `flex min-h-dvh flex-col ${FILE_VIEWER_DOCUMENT_FLOW_FULLSCREEN_VIEWPORT_CLASS_NAME}`
							: cn(
									"flex h-full flex-col",
									effectiveIsFullscreen &&
										FILE_VIEWER_FULLSCREEN_VIEWPORT_CLASS_NAME,
								),
					)}
				>
					<div
						className={cn(
							isDocumentFlowFullscreen
								? "flex min-h-dvh min-w-0 flex-col"
								: "flex h-full min-h-0 min-w-0 flex-col",
							// Fullscreen fixed layers bypass BaseLayoutPc padding, so this shell reapplies safe-area insets.
							effectiveIsFullscreen &&
								!isDocumentFlowFullscreen &&
								shouldUseSafeAreaFullscreen &&
								FILE_VIEWER_FULLSCREEN_SAFE_AREA_CLASS_NAME,
						)}
					>
						{/* Tab Bar — hidden in immersive read-only mode (e.g. audio recording detail) */}
						{tabs.length === 0 &&
							fileSidebarButton &&
							!effectiveIsFullscreen &&
							!props.hideTabBar && (
								<div className="flex h-11 shrink-0 items-center border-b border-border bg-accent">
									{fileSidebarButton}
								</div>
							)}
						{tabs.length > 0 && !effectiveIsFullscreen && !props.hideTabBar && (
							<div className="relative flex h-11 shrink-0 items-center bg-accent">
								{fileSidebarButton}
								<HeadlessHorizontalScroll
									className="h-full min-w-0 flex-1"
									controlBackground="rgb(var(--accent-rgb))"
									scrollContainerClassName="no-scrollbar flex h-full w-full items-center overflow-x-auto overflow-y-hidden px-1 gap-0.5"
									scrollContainerRef={tabsContainerRef}
									dragIgnoreSelector="[data-tab-id], button, a, input, [role='button']"
									onScrollContainerContextMenu={handleContainerContextMenu}
								>
									{tabs.map(renderTabItem)}
								</HeadlessHorizontalScroll>

								{shouldRenderQuickOpen ? (
									<WebsitePresetMenu
										onOpenWebsiteTab={openWebsiteTab}
										onOpenMicroAppTab={openMicroAppTab}
										onOpenFileTab={openFileTab}
										fileAttachments={tabAttachments}
									/>
								) : null}

								{/* 展开按钮 */}
								<DropdownMenu
									open={expandPanelVisible}
									onOpenChange={setExpandPanelVisible}
								>
									<Tooltip
										title={
											expandPanelVisible
												? null
												: t("fileViewer.tabs.openTabs")
										}
										placement="bottom"
										trigger={["hover", "focus"]}
										mouseEnterDelay={0.3}
									>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												aria-label={t("fileViewer.tabs.openTabs")}
												className="relative mx-1 flex size-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-md transition-all duration-200 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											>
												<MagicIcon component={IconMenu2} size={18} />
											</button>
										</DropdownMenuTrigger>
									</Tooltip>
									<DropdownMenuContent
										align="end"
										className="max-h-[300px] w-[180px] overflow-y-auto p-1"
									>
										{tabs.map(renderExpandPanelItem)}
									</DropdownMenuContent>
								</DropdownMenu>

								{props.onPreviewCollapse ? (
									<Tooltip
										title={t("fileViewer.tabs.collapsePreview")}
										placement="bottom"
										trigger={["hover", "focus"]}
										mouseEnterDelay={0.3}
									>
										<button
											type="button"
											className="relative mr-1 flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											aria-label={t("fileViewer.tabs.collapsePreview")}
											aria-expanded={true}
											onClick={handlePreviewCollapse}
											data-files-viewer-collapse-preview
										>
											<MagicIcon component={IconX} size={16} />
										</button>
									</Tooltip>
								) : hasCloseableTabs ? (
									<Tooltip
										title={t("shortcut.closeAllTabs")}
										placement="bottom"
										mouseEnterDelay={0.3}
									>
										{/* 关闭所有 tab 按钮 */}
										<div
											className="relative mr-1 flex size-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-md transition-all duration-200 hover:bg-black/10"
											onClick={handleClearAllTabs}
											data-testid="handle-clear-all-tabs"
										>
											<MagicIcon component={IconX} size={16} />
										</div>
									</Tooltip>
								) : null}
							</div>
						)}

						{/* 右键菜单 */}
						<TabContextMenu
							contextMenuState={contextMenuState}
							getContextMenuItems={getContextMenuItems}
							onClose={hideContextMenu}
						/>
						<CommonWebsitePresetDialog
							open={commonWebsiteDialogOpen}
							mode="add"
							initialValues={commonWebsiteInitialValues}
							onOpenChange={setCommonWebsiteDialogOpen}
							onSubmit={handleSubmitCommonWebsite}
						/>

						{/* Content Area */}
						<div
							className={cn(
								isDocumentFlowFullscreen
									? "flex min-h-dvh flex-col overflow-visible"
									: "flex flex-1 flex-col overflow-hidden",
							)}
						>
							{currentTab ? (
								isRestoringFileTabs ? (
									<div className="flex h-full items-center justify-center">
										<MagicSpin spinning />
									</div>
								) : (
									<>
										{/* Cached preview tabs use stable body portals outside document-flow share mode. */}
										{inlineCachedTabs}
										{hasActiveStableTab ? (
											<div
												ref={setStablePreviewSurfaceAnchor}
												className="relative min-h-0 flex-1"
												data-files-viewer-preview-anchor="true"
												data-files-viewer-ppt-anchor={
													isActivePptPreview ? "true" : undefined
												}
											/>
										) : null}
									</>
								)
							) : shouldShowDetailEmpty ? (
								<DetailEmpty />
							) : null}
						</div>
					</div>
				</div>
			)

			// Fixed fullscreen layers can be trapped by transformed workspace ancestors, so the
			// viewer shell uses a body portal. Preview TabCache nodes live in the single stable
			// sibling Portal; document-flow fullscreen stays in the share document tree.
			const viewerLayer =
				effectiveIsFullscreen &&
				!isDocumentFlowFullscreen &&
				typeof document !== "undefined"
					? createPortal(viewer, document.body)
					: viewer

			return (
				<>
					<StablePreviewPortalSurface
						anchor={stablePreviewSurfaceAnchor}
						borderRadius={
							// The preview is portaled to document.body, so the detail card's
							// rounded-lg cannot clip it. Keep the card's bottom corners here,
							// unless the page frames the surface itself (AI canvas).
							effectiveIsFullscreen
								? "0px"
								: (props.previewSurfaceFrame?.radius ??
									(props.hideTabBar ? "0.5rem" : "0px 0px 0.5rem 0.5rem"))
						}
						outlineColor={
							effectiveIsFullscreen
								? undefined
								: props.previewSurfaceFrame?.outlineColor
						}
						overlay={effectiveIsFullscreen ? undefined : props.previewSurfaceOverlay}
						className={
							effectiveIsFullscreen ? undefined : props.previewSurfaceFrame?.className
						}
						enabled={Boolean(currentTab) && !isRestoringFileTabs && hasStableTabs}
						isFullscreen={effectiveIsFullscreen}
						isPpt={isActivePptPreview}
						visible={hasActiveStableTab && !props.isPreviewCollapsed}
					>
						{stableCachedTabs}
					</StablePreviewPortalSurface>
					{viewerLayer}
					{fileInfoPanel}
				</>
			)
		}),
	),
)

FilesViewer.displayName = "FilesViewer"

export default FilesViewer

// Export ref type for external usage
export type { FilesViewerRef }
