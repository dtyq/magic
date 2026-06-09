import { useEffect, useRef, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { ChevronDown, Loader2, PanelLeftOpen, Presentation, Plus } from "lucide-react"
import PPTSlide from "./PPTSlide"
import PPTSidebar from "./PPTSidebar/index"
import { PPTControlBar } from "./PPTControlBar"
import {
	usePPTSidebar,
	useFullscreen,
	useSlideFileLocator,
	useCheckBeforeNavigate,
	useScrollActiveSlideIntoView,
	usePPTEventBus,
	usePPTStore,
	useSyncActiveState,
	useSlideSync,
	useSlideNavigation,
	useSlideHandlers,
} from "./hooks"
import { useResizableSidebar } from "./hooks/useResizableSidebar"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { TAILWIND_Z_INDEX_CLASSES } from "../../contents/HTML/constants/z-index"
import TextAnimation from "@/components/animations/TextAnimation"
import { MagicDropdown, MagicTooltip } from "@/components/base"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { PPTProvider } from "./contexts/PPTContext"
import { useContainerShowButtonText } from "@/hooks/useContainerShowButtonText"
import type { MenuProps } from "antd"

interface ManualSaveResult {
	fileId?: string
	cleanContent?: string
}

interface PPTRenderProps {
	// ========== 外部依赖（必需） ==========
	slidePaths: string[]
	attachments?: any[]
	attachmentList?: any[]
	mainFileId?: string
	mainFileName?: string
	filePathMapping: Map<string, string>
	selectedProject?: any
	projectId?: string
	displayConfig?: any
	allowDownload?: boolean

	// ========== 受控状态（可选） ==========
	/** 初始激活索引（用于缓存恢复） */
	initialActiveIndex?: number
	/** 激活索引变化时的回调 */
	onActiveIndexChange?: (index: number, fileId: string) => void

	// ========== 模式标志 ==========
	isPlaybackMode?: boolean
	allowEdit?: boolean

	// ========== 业务回调 ==========
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
	onSortSave?: (newSlidesUrls: string[]) => void
	openNewTab?: (fileId: string, path: string) => void
	onDownload?: ({
		fileId,
		fileVersion,
	}: {
		fileId: string
		fileVersion?: number
		type?: "file" | "pdf" | "ppt"
	}) => void
	onFullscreen?: () => void
	isTabActive?: boolean
	onRegisterCheckBeforeClose?: (fileId: string, callback: () => Promise<boolean>) => void
	onUnregisterCheckBeforeClose?: (fileId: string) => void
}

/**
 * PPTRender 包装组件
 * 创建事件总线和 store 实例并提供给子组件
 */
const PPTRender = function PPTRender(props: PPTRenderProps) {
	const {
		slidePaths,
		attachments,
		attachmentList,
		mainFileId,
		mainFileName,
		displayConfig,
		selectedProject,
		projectId,
		allowDownload,
	} = props

	const { organizationCode } = useOrganization()
	const resolvedProjectId = selectedProject?.id || projectId
	const effectiveDisplayConfig = useMemo(() => {
		if (!slidePaths?.length) return displayConfig
		return {
			...displayConfig,
			slides: slidePaths,
		}
	}, [displayConfig, slidePaths])

	const storeConfig = useMemo(
		() => ({
			attachments,
			attachmentList,
			projectId: resolvedProjectId,
			mainFileId,
			mainFileName,
			displayConfig: effectiveDisplayConfig,
			organizationCode,
			selectedProjectId: selectedProject?.id,
			enableCache: true,
			allowDownload,
		}),
		[
			attachments,
			attachmentList,
			resolvedProjectId,
			mainFileId,
			mainFileName,
			effectiveDisplayConfig,
			organizationCode,
			selectedProject?.id,
			allowDownload,
		],
	)

	return (
		<PPTProvider storeConfig={storeConfig}>
			<PPTRenderInner {...props} />
		</PPTProvider>
	)
}

/**
 * PPTRenderInner - PPT 渲染主逻辑
 * 使用事件总线进行组件间通信
 */
const PPTRenderInner = observer(function PPTRenderInner({
	slidePaths,
	attachments,
	attachmentList,
	projectId,
	mainFileId,
	mainFileName,
	filePathMapping,
	selectedProject,
	initialActiveIndex,
	onActiveIndexChange,
	isPlaybackMode,
	allowEdit = false,
	saveEditContent,
	onSortSave,
	openNewTab,
	onDownload,
	onFullscreen: onFileFullscreen,
	isTabActive,
	allowDownload,
	onRegisterCheckBeforeClose,
	onUnregisterCheckBeforeClose,
}: PPTRenderProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const containerRef = useRef<HTMLDivElement>(null)
	const { onDownloadRequest, onFullscreenToggle, emitFullscreenStateChange } = usePPTEventBus()
	const store = usePPTStore()

	const [isAnySlideEditing, setIsAnySlideEditing] = useState(false)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
	const activeSlideCloseSaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)
	const activeSlideDiscardHandlerRef = useRef<(() => Promise<boolean>) | null>(null)

	const { sidebarWidth, isResizing, handleResizeStart } = useResizableSidebar({
		containerRef,
		minWidth: 160,
		defaultWidth: 200,
	})

	const {
		checkBeforeNavigate,
		registerSaveHandler,
		registerDiscardHandler: registerDiscardHandlerForNavigation,
		showNavigationDialog,
		setShowNavigationDialog,
		isSavingForNavigation,
		targetPageNumber,
		handleSaveAndNavigate,
		handleDiscardAndNavigate,
		handleCancelNavigation,
	} = useCheckBeforeNavigate({
		isAnySlideEditing,
		activeIndex: store.activeIndex,
	})

	// 幻灯片初始化与增量同步
	useSlideSync({ store, slidePaths, initialActiveIndex })

	// 当激活索引或文件 ID 变化时通知父组件
	useSyncActiveState({ store, onActiveIndexChange, isTabActive })

	// 幻灯片操作处理函数（编辑/刷新/截图/侧边栏）
	const {
		handleEditModeChange,
		handleRefreshSlide,
		handleRefreshAllSlides,
		handleRegenerateScreenshot,
		handleSidebarCollapsedChange,
	} = useSlideHandlers({ store, setIsAnySlideEditing, setIsSidebarCollapsed })

	// 在文件树中定位活动幻灯片，并将缩略图滚动到可见区域
	useSlideFileLocator({ store })
	useScrollActiveSlideIntoView({ store })

	// 全屏功能 - 在 usePPTSidebar 之前调用以便后续使用 isFullscreen
	const { isFullscreen, toggleFullscreen } = useFullscreen({ containerRef })

	// 同步全屏状态到 store 以计算 visibleSlides
	useEffect(() => {
		store.setFullscreen(isFullscreen)
	}, [isFullscreen, store])

	// 订阅下载事件
	useEffect(() => {
		const unsubscribe = onDownloadRequest((payload) => {
			onDownload?.(payload)
		})
		return unsubscribe
	}, [onDownload, onDownloadRequest])

	// 订阅全屏切换事件
	useEffect(() => {
		const unsubscribe = onFullscreenToggle(() => {
			if (onFileFullscreen) onFileFullscreen()
			else toggleFullscreen()
		})
		return unsubscribe
	}, [onFileFullscreen, toggleFullscreen, onFullscreenToggle])

	// 发出全屏状态变化事件
	useEffect(() => {
		emitFullscreenStateChange(isFullscreen)
	}, [isFullscreen, emitFullscreenStateChange])

	// 在移动模式下禁用编辑功能
	const effectiveAllowEdit = allowEdit && !isMobile

	// 获取用于创建新幻灯片的项目 ID 和父级 ID
	const resolvedProjectId = selectedProject?.id || projectId
	const parentId = useMemo(() => {
		if (!attachmentList?.length || !store.slidePaths.length) return undefined

		const firstSlidePath = store.slidePaths[0]
		const firstSlideFileId = store.getFileIdByPath(firstSlidePath)
		const firstSlideFile = attachmentList.find((item: any) => item.file_id === firstSlideFileId)
		return firstSlideFile?.parent_id
	}, [attachmentList, store])

	const {
		handleSlideClick,
		handleSortChange,
		handleInsertSlide,
		handleDeleteSlide,
		handleRenameSlide,
		handleAddToCurrentChat,
		handleAddToNewChat,
		isDeleteModalOpen,
	} = usePPTSidebar({
		slides: store.slides,
		activeIndex: store.activeIndex,
		isTransitioning: store.isTransitioning,
		allowEdit: effectiveAllowEdit,
		attachments,
		attachmentList,
		mainFileId,
		mainFileName,
		projectId: resolvedProjectId,
		parentId,
		setActiveIndex: async (index) => {
			const canNavigate = await checkBeforeNavigate("jump", index)
			if (!canNavigate) return

			store.setActiveIndex(index)
		},
		setIsTransitioning: (value) => store.setIsTransitioning(value),
		onSortSave,
		store,
		isAnySlideEditing,
	})

	// 导航函数（上一张/下一张/跳转）
	const { changeSlide, goToFirstSlide, handleJumpToPage } = useSlideNavigation({
		store,
		checkBeforeNavigate,
	})

	// 键盘导航 - 依赖 usePPTSidebar 返回的 isDeleteModalOpen
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement
			) {
				return
			}

			if (isAnySlideEditing || isDeleteModalOpen) return

			switch (event.key) {
				case "ArrowLeft":
				case "ArrowUp":
				case "PageUp":
					changeSlide("prev")
					break
				case "ArrowRight":
				case "ArrowDown":
				case "PageDown":
					changeSlide("next")
					break
				case " ":
					if (isFullscreen) changeSlide("next")
					break
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [changeSlide, isFullscreen, isAnySlideEditing, isDeleteModalOpen])

	// iframe postMessage 导航 - 依赖 usePPTSidebar 返回的 isDeleteModalOpen
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (!event.data || event.data.type !== "keyboardEvent") return
			if (isAnySlideEditing || store.isTransitioning || isDeleteModalOpen) return

			const { direction } = event.data
			switch (direction) {
				case "prev":
				case "pageup":
					changeSlide("prev")
					break
				case "next":
				case "pagedown":
					changeSlide("next")
					break
				case "first":
					goToFirstSlide()
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [changeSlide, goToFirstSlide, store.isTransitioning, isAnySlideEditing, isDeleteModalOpen])

	const slideContainerRef = useRef<HTMLDivElement>(null)
	const shouldShowButtonText = useContainerShowButtonText(slideContainerRef, 700)

	const visibleSlides = store.visibleSlides
	const hasSlides = store.slideUrls.length > 0

	// 识别“待初始化窗口”：slidePaths 已就绪，但 store 还未灌入 slides
	// 这个窗口出现在首帧渲染到 useDeepCompareEffect 触发之间
	const isPendingInit = slidePaths.length > 0 && store.slides.length === 0
	// 加载层优先级高于空态，避免初始化瞬间误显示“无 PPT 页面”
	const isLoadingOverlayVisible = !store.isReady || isPendingInit
	// 仅在真正初始化完成且无可用页面时展示空态
	const isNoSlidesFallbackVisible = store.isReady && !isPendingInit && !hasSlides

	// 计算当前幻灯片的相对文件路径（供 PPTSlide 使用）
	const relative_file_path = useMemo(() => {
		const currentPath = store.slidePaths[store.activeIndex]
		const fileId = store.getFileIdByPath(currentPath)
		const file_item = attachmentList?.find((item) => item.file_id === fileId)
		return file_item?.relative_file_path.replace(file_item?.file_name, "")
	}, [attachmentList, store])

	// 手动保存处理函数 - 使用 useMemoizedFn 避免每次渲染重新创建
	const handleManualSave = useMemoizedFn(async (saveResult: ManualSaveResult, index: number) => {
		if (!saveResult) return
		const cleanContent = saveResult.cleanContent || ""

		if (saveResult.fileId) store.markSlideAsManuallySaved(saveResult.fileId)
		// 保存后的原始 HTML 需要先经过 PPT 资源路径处理，否则缩略图会用未解析的背景资源截图。
		const processedContent = await store.updateSlideContent(index, cleanContent)
		const thumbnailContent = processedContent || cleanContent
		await store.generateSlideScreenshot(index, thumbnailContent)
	})

	const registerCloseSaveHandler = useMemoizedFn((handler: (() => Promise<boolean>) | null) => {
		activeSlideCloseSaveHandlerRef.current = handler
	})

	const registerDiscardHandlerForClose = useMemoizedFn(
		(handler: (() => Promise<boolean>) | null) => {
			activeSlideDiscardHandlerRef.current = handler
		},
	)

	const registerDiscardHandler = useMemoizedFn((handler: (() => Promise<boolean>) | null) => {
		registerDiscardHandlerForNavigation(handler)
		registerDiscardHandlerForClose(handler)
	})

	const handleCheckBeforeClose = useMemoizedFn(async (): Promise<boolean> => {
		if (!isAnySlideEditing) return true

		return await new Promise<boolean>((resolve) => {
			const fileName = mainFileName || t("common.untitledFile")

			const handleDirectClose = async () => {
				try {
					const didDiscard = activeSlideDiscardHandlerRef.current
						? await activeSlideDiscardHandlerRef.current()
						: true
					if (!didDiscard) return

					modal.destroy()
					resolve(true)
				} catch (error) {
					console.error("Failed to discard slide changes before close:", error)
				}
			}

			const handleSaveAndClose = async () => {
				try {
					const didSave = activeSlideCloseSaveHandlerRef.current
						? await activeSlideCloseSaveHandlerRef.current()
						: true
					if (!didSave) return

					modal.destroy()
					resolve(true)
				} catch (error) {
					console.error("Failed to save slide before close:", error)
				}
			}

			const menuItems: MenuProps["items"] = [
				{
					key: "directClose",
					label: t("detail.directClose"),
					onClick: () => {
						void handleDirectClose()
					},
				},
			]

			const modal = MagicModal.confirm({
				title: t("detail.closeEditingFilePrompt", { fileName }),
				content: t("detail.closeEditingFileContent"),
				cancelText: t("common.cancel"),
				closable: false,
				maskClosable: false,
				centered: true,
				footer: (_, { CancelBtn }) => (
					<div className={cn("flex items-center justify-end gap-2 px-4 pb-4")}>
						<CancelBtn />
						{activeSlideCloseSaveHandlerRef.current ? (
							<MagicDropdown menu={{ items: menuItems }} trigger={["hover"]}>
								<span>
									<Button onClick={() => void handleSaveAndClose()}>
										{t("detail.saveAndClose")}
										<ChevronDown className="ml-1 size-4" />
									</Button>
								</span>
							</MagicDropdown>
						) : (
							<Button onClick={() => void handleDirectClose()}>
								{t("common.confirm")}
							</Button>
						)}
					</div>
				),
				onCancel: () => {
					modal.destroy()
					resolve(false)
				},
			})
		})
	})

	useEffect(() => {
		if (!mainFileId || !onRegisterCheckBeforeClose) return

		onRegisterCheckBeforeClose(mainFileId, handleCheckBeforeClose)

		return () => {
			onUnregisterCheckBeforeClose?.(mainFileId)
		}
	}, [
		handleCheckBeforeClose,
		mainFileId,
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
	])

	return (
		<>
			<div
				ref={containerRef}
				data-testid="ppt-render-container"
				className={
					isFullscreen
						? `fixed inset-0 ${TAILWIND_Z_INDEX_CLASSES.FULLSCREEN.CONTAINER} flex flex-row`
						: "relative h-full w-full overflow-hidden"
				}
			>
				{isSidebarCollapsed && (
					<MagicTooltip title={t("fileViewer.expandSidebar")}>
						<Button
							variant="ghost"
							size="icon"
							data-testid="ppt-render-expand-sidebar-button"
							className={cn(
								"absolute z-10 h-8 w-8 shrink-0 border border-border bg-white text-foreground shadow-sm dark:bg-card",
								isMobile ? "bottom-2 left-2" : "left-2 top-2",
							)}
							onClick={() => setIsSidebarCollapsed(false)}
						>
							<PanelLeftOpen className="h-4 w-4" />
						</Button>
					</MagicTooltip>
				)}

				<div
					className={cn(
						"relative flex h-full w-full",
						isMobile ? "flex-col-reverse" : "flex-row",
					)}
				>
					{/* 侧边栏 - 桌面端在左侧，移动端在顶部 */}
					<div
						data-testid="ppt-render-sidebar"
						className={cn(
							"shrink-0 overflow-hidden",
							!isResizing && "transition-all duration-300 ease-in-out",
							isMobile
								? isSidebarCollapsed || isFullscreen
									? "h-0"
									: "h-[140px]"
								: "",
						)}
						style={{
							width: !isMobile
								? isSidebarCollapsed || isFullscreen
									? 0
									: sidebarWidth
								: undefined,
						}}
					>
						<div
							style={{
								width: isMobile ? "100%" : sidebarWidth,
								height: isMobile ? "140px" : "100%",
							}}
						>
							<PPTSidebar
								onSlideClick={handleSlideClick}
								onSortChange={effectiveAllowEdit ? handleSortChange : undefined}
								onInsertSlide={effectiveAllowEdit ? handleInsertSlide : undefined}
								onDeleteSlide={effectiveAllowEdit ? handleDeleteSlide : undefined}
								onRenameSlide={effectiveAllowEdit ? handleRenameSlide : undefined}
								onRefreshSlide={effectiveAllowEdit ? handleRefreshSlide : undefined}
								onRegenerateScreenshot={handleRegenerateScreenshot}
								onAddToCurrentChat={handleAddToCurrentChat}
								onAddToNewChat={handleAddToNewChat}
								mainFileId={mainFileId}
								isMobile={isMobile}
								allowEdit={effectiveAllowEdit}
								isCollapsed={isSidebarCollapsed}
								onCollapsedChange={handleSidebarCollapsedChange}
							/>
						</div>
					</div>

					{/* 调整宽度的 Handle - 仅在桌面端且侧边栏未折叠/全屏时显示 */}
					{!isMobile && !isSidebarCollapsed && !isFullscreen && (
						<div
							data-testid="ppt-render-sidebar-resize-handle"
							className="absolute bottom-0 top-0 z-20 w-4 -translate-x-1/2 cursor-col-resize bg-transparent"
							style={{ left: sidebarWidth }}
							onMouseDown={handleResizeStart}
						/>
					)}

					{/* 主内容区 - flex-1 占据剩余空间 */}
					<div
						ref={slideContainerRef}
						data-testid="ppt-render-slide-content"
						className="min-h-0 min-w-0 flex-1"
					>
						<div
							className="relative h-full w-full overflow-hidden"
							tabIndex={0}
							aria-label={
								hasSlides
									? `Slide ${store.activeIndex + 1} of ${store.slideUrls.length}`
									: t("ppt.noSlidesAvailable")
							}
						>
							<div className="relative h-full w-full overflow-hidden">
								{/* 调整宽度时覆盖层防止 iframe 拦截鼠标事件 */}
								{isResizing && (
									<div className="absolute inset-0 z-50 bg-transparent" />
								)}

								{/* 加载状态 - 初始化时显示 */}
								{isLoadingOverlayVisible && (
									<div
										data-testid="ppt-render-loading"
										className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
									>
										<div className="flex items-center gap-2">
											<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
											<TextAnimation dotwaveAnimation>
												{t("ppt.loading")}
											</TextAnimation>
											{store.loadingProgress > 0 && (
												<p className="text-xs text-muted-foreground">
													{store.loadingProgress}%
												</p>
											)}
										</div>
									</div>
								)}

								{isNoSlidesFallbackVisible && (
									<div
										data-testid="ppt-render-empty"
										className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-sm"
									>
										<div className="flex flex-col items-center gap-2 text-center">
											<Presentation className="h-16 w-16 text-foreground" />
											<h3 className="text-xl font-medium text-foreground">
												{t("fileViewer.noSlidesTitle")}
											</h3>
											<p className="max-w-[300px] text-sm text-muted-foreground">
												{effectiveAllowEdit
													? t("fileViewer.emptyStateDescription")
													: ""}
											</p>
										</div>

										{effectiveAllowEdit && (
											<Button
												data-testid="ppt-render-create-first-slide-button"
												onClick={() => handleInsertSlide(0, "after")}
												className="gap-2"
												size="lg"
											>
												<Plus className="h-4 w-4" />
												{t("fileViewer.createFirstSlide")}
											</Button>
										)}
									</div>
								)}

								{visibleSlides.map(({ slide, index }) => {
									const slideFileId = store.getFileIdByPath(slide.path) || ""
									return (
										<PPTSlide
											key={slide.id}
											index={index}
											isActive={index === store.activeIndex}
											content={slide.content || ""}
											rawContent={slide.rawContent || ""}
											loadingState={slide.loadingState}
											loadingError={slide.loadingError}
											isFullscreen={isFullscreen}
											isPlaybackMode={isPlaybackMode}
											saveEditContent={saveEditContent}
											fileId={slideFileId}
											projectId={resolvedProjectId}
											filePathMapping={filePathMapping}
											openNewTab={
												openNewTab ||
												(() => {
													// 空操作回退
												})
											}
											relative_file_path={relative_file_path}
											selectedProject={selectedProject}
											attachmentList={attachmentList}
											attachments={attachments}
											updateSlideContents={(
												newContents: Map<number, string>,
											) => {
												store.updateSlideContents(newContents)
											}}
											allowEdit={effectiveAllowEdit}
											onEditModeChange={(isEditing) =>
												handleEditModeChange(slideFileId, isEditing)
											}
											onRegisterSaveHandler={
												index === store.activeIndex
													? registerSaveHandler
													: undefined
											}
											onRegisterDiscardHandler={
												index === store.activeIndex
													? registerDiscardHandler
													: undefined
											}
											onRegisterCloseSaveHandler={
												index === store.activeIndex
													? registerCloseSaveHandler
													: undefined
											}
											serverUpdatedContent={store.getSlideServerUpdate(
												slideFileId,
											)}
											onClearServerUpdate={() => {
												store.clearSlideServerUpdate(slideFileId)
											}}
											onRefreshSlide={handleRefreshSlide}
											onManualSave={handleManualSave}
											showButtonText={shouldShowButtonText}
											mainFileId={mainFileId}
											mainFileName={mainFileName}
											allowDownload={allowDownload}
										/>
									)
								})}
							</div>

							{/* 控制栏 - 在编辑模式和全屏模式下隐藏 */}
							{!isAnySlideEditing && !isFullscreen && store.isReady && hasSlides && (
								<PPTControlBar
									activeIndex={store.activeIndex}
									totalSlides={store.slideUrls.length}
									isTransitioning={store.isTransitioning}
									isMobile={isMobile}
									isFullscreen={isFullscreen}
									onPrevSlide={() => changeSlide("prev")}
									onNextSlide={() => changeSlide("next")}
									onGoToFirstSlide={goToFirstSlide}
									onRefreshSlides={handleRefreshAllSlides}
									onJumpToPage={handleJumpToPage}
									onToggleFullscreen={toggleFullscreen}
									t={t}
								/>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* 导航确认对话框 */}
			<AlertDialog open={showNavigationDialog} onOpenChange={setShowNavigationDialog}>
				<AlertDialogContent data-testid="ppt-render-navigation-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.navigationConfirmTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.navigationConfirmDescription", { page: targetPageNumber })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<AlertDialogCancel
							data-testid="ppt-render-navigation-dialog-cancel"
							onClick={handleCancelNavigation}
							disabled={isSavingForNavigation}
						>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							data-testid="ppt-render-navigation-dialog-discard"
							onClick={handleDiscardAndNavigate}
							disabled={isSavingForNavigation}
							className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
						>
							{t("ppt.discardAndNavigate")}
						</AlertDialogAction>
						<AlertDialogAction
							data-testid="ppt-render-navigation-dialog-save"
							onClick={handleSaveAndNavigate}
							disabled={isSavingForNavigation}
						>
							{isSavingForNavigation ? t("ppt.saving") : t("ppt.saveAndNavigate")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
})

export default PPTRender
