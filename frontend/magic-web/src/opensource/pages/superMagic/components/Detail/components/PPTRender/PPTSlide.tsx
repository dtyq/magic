import { useState, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { FileX, Loader2 } from "lucide-react"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../contents/HTML/IsolatedHTMLRenderer"
import EditToolbar from "@/opensource/pages/superMagic/components/Detail/components/EditToolbar"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/opensource/components/shadcn-ui/alert-dialog"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import useEditMode from "../../hooks/useEditMode"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import useServerUpdate from "../../hooks/useServerUpdate"
import { observer } from "mobx-react-lite"
import { SaveResult } from "../../contents/HTML/iframe-bridge/types/props"
import type { SlideLoadingState } from "./PPTSidebar/types"
import PPTSlideError from "./PPTSlideError"
import VersionCompareDialog from "./components/VersionCompareDialog"
import HistoryVersionCompareDialog from "./components/HistoryVersionCompareDialog"
import { CodeEditor } from "@/opensource/components/base"
import { shadow } from "@/opensource/utils/shadow"
import { useMemoizedFn } from "ahooks"
import { processHtmlContent, type ProcessHtmlContentInput } from "../../contents/HTML/htmlProcessor"
import { usePPTVersionManager } from "./hooks/usePPTVersionManager"
import { cn } from "@/opensource/lib/utils"
import useShareRoute from "@/opensource/pages/superMagic/hooks/useShareRoute"
import { AttachmentItem } from "../../../TopicFilesButton/hooks"

interface PPTSlideProps {
	index: number
	isActive: boolean
	content: string
	rawContent: string
	isFullscreen: boolean
	isPlaybackMode?: boolean
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
	fileId: string
	filePathMapping: Map<string, string>
	openNewTab: (fileId: string, path: string) => void
	relative_file_path?: string
	selectedProject?: any
	attachmentList?: any[]
	updateSlideContents: (newContents: Map<number, string>) => void
	loadingState?: SlideLoadingState
	loadingError?: Error
	allowEdit?: boolean
	/** 当幻灯片变为非激活状态时的回调 */
	onDeactivate?: () => void
	/** 编辑状态变化回调 - 通知父组件当前幻灯片的编辑状态 */
	onEditModeChange?: (isEditing: boolean) => void
	/** 注册保存处理器 - 用于导航确认对话框 */
	onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void
	/** Callback when user manually saves - mark as manual save and update thumbnail */
	onManualSave?: (saveResult: SaveResult | undefined, index: number) => Promise<void>
	/** Server updated content (passed from parent) */
	serverUpdatedContent?: string
	/** Callback to clear server update flag */
	onClearServerUpdate?: () => void
	/** Callback to refresh current slide content from server */
	onRefreshSlide?: (index: number) => Promise<void>
	/** 是否显示按钮文字 */
	showButtonText?: boolean
	/** 主 PPT 文件 ID（用于分享整个 PPT） */
	mainFileId?: string
	/** 主 PPT 文件名（用于分享整个 PPT） */
	mainFileName?: string
	/** 附件列表 */
	attachments?: AttachmentItem[]
}

const PPTSlide = observer(function PPTSlide({
	index,
	isActive,
	content,
	rawContent,
	isFullscreen,
	isPlaybackMode,
	saveEditContent,
	fileId,
	filePathMapping,
	openNewTab,
	relative_file_path,
	selectedProject,
	attachmentList,
	updateSlideContents,
	loadingState = "idle",
	loadingError,
	allowEdit = false,
	onDeactivate,
	onEditModeChange,
	onRegisterSaveHandler,
	onManualSave,
	serverUpdatedContent: externalServerUpdatedContent,
	onClearServerUpdate,
	onRefreshSlide,
	showButtonText,
	mainFileId,
	mainFileName,
	attachments,
}: PPTSlideProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	// 内部管理编辑模式
	const { isEditMode, setIsEditMode } = useEditMode({ fileId })
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	const [pendingDeactivate, setPendingDeactivate] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	// 保存 IsolatedHTMLRenderer 暴露的保存函数引用
	const [triggerSaveRef, setTriggerSaveRef] = useState<
		(() => Promise<SaveResult | undefined>) | null
	>(null)
	// IsolatedHTMLRenderer 的 ref，用于重置内容
	const rendererRef = useRef<IsolatedHTMLRendererRef>(null)

	const { isShareRoute } = useShareRoute()

	// Use specialized PPT version manager hook
	const {
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		fetchFileVersions,
		handleVersionRollback,
		isNewestVersion,
		versionContent,
		getVersionContentForCompare,
	} = usePPTVersionManager({
		fileId: fileId || "",
	})

	const [displayContent, setDisplayContent] = useState<{ content: string; rawContent: string }>({
		content: content,
		rawContent: rawContent,
	})

	// 历史版本对比弹窗状态
	const [showHistoryCompareDialog, setShowHistoryCompareDialog] = useState(false)
	const [compareHistoryVersion, setCompareHistoryVersion] = useState<number | undefined>(
		undefined,
	)
	const [compareHistoryContent, setCompareHistoryContent] = useState<string>("")

	// 处理历史版本内容 - 进行路径替换
	const processHistoricalContent = useMemoizedFn(async (rawContent: string) => {
		try {
			const input: ProcessHtmlContentInput = {
				content: rawContent,
				attachments: attachmentList,
				fileId: fileId,
				fileName: `slide_${index}.html`,
				attachmentList: attachmentList,
				html_relative_path: relative_file_path,
			}

			const result = await processHtmlContent(input)
			return result.processedContent
		} catch (error) {
			console.error("Failed to process historical content:", error)
			// 如果处理失败，返回原始内容
			return rawContent
		}
	})

	// Listen to version content changes (when switching versions)
	useEffect(() => {
		if (versionContent && typeof versionContent === "string") {
			// Process historical version content with path replacement
			processHistoricalContent(versionContent).then((processedContent) => {
				setDisplayContent({ content: processedContent, rawContent: versionContent })
				// Notify renderer to update content
				if (rendererRef.current) {
					rendererRef.current.updateContent(processedContent)
				}
			})
		}
	}, [versionContent, processHistoricalContent])

	// 当传入的 content 变化且不在查看历史版本时，更新显示内容
	useEffect(() => {
		if (!fileVersion && rawContent !== displayContent.rawContent) {
			processHistoricalContent(rawContent).then((processedContent) => {
				setDisplayContent({ content: processedContent, rawContent })
				if (rendererRef.current) {
					rendererRef.current.updateContent(processedContent)
				}
			})
		}
	}, [rawContent, fileVersion, displayContent, processHistoricalContent])

	// 服务端更新状态管理 - 使用自定义 hook
	const {
		hasServerUpdate,
		actualServerContent,
		showVersionCompareDialog,
		showSaveWithUpdateConfirmDialog,
		currentEditingContent,
		handleViewServerUpdate,
		handleUseMyVersion,
		handleUseServerVersion,
		clearServerUpdate,
		checkServerUpdateBeforeSave,
		setShowVersionCompareDialog,
		setShowSaveWithUpdateConfirmDialog,
		applyServerUpdate,
	} = useServerUpdate({
		externalServerUpdatedContent,
		onClearServerUpdate,
		isEditMode,
		rendererRef,
		content: displayContent.rawContent,
	})

	// 通知父组件编辑状态变化
	useEffect(() => {
		if (isActive) {
			onEditModeChange?.(isEditMode)
		}
	}, [isEditMode, isActive, onEditModeChange])

	// 检测是否应该显示编辑工具栏
	const showEditToolbar = useMemo(() => {
		return !isMobile && !isFullscreen && !isPlaybackMode
	}, [isMobile, isFullscreen, isPlaybackMode])

	const slideWrapperClassNames = cn(
		isFullscreen ? "absolute left-0 top-0 block h-full w-full" : "flex h-full w-full flex-col",
	)
	// Keep layout for all slides to prevent re-mounting and flickering
	const slideWrapperStyle: CSSProperties = {
		visibility: isActive ? "visible" : "hidden",
		pointerEvents: isActive ? "auto" : "none",
		// Optimize rendering performance
		willChange: isActive ? "auto" : "transform",
	}

	// 接收 IsolatedHTMLRenderer 暴露的保存函数
	const handleSaveReady = useCallback((triggerSave: () => Promise<SaveResult | undefined>) => {
		setTriggerSaveRef(() => triggerSave)
	}, [])

	// 当幻灯片变为非激活状态时，检查是否需要提示保存
	useEffect(() => {
		if (!isActive && isEditMode) {
			// 显示保存提示对话框
			setShowSaveDialog(true)
			setPendingDeactivate(true)
		}
	}, [isActive, isEditMode])

	// 编辑按钮处理
	const handleEdit = useCallback(() => {
		// 如果正在查看历史版本，先回到最新版本
		if (fileVersion) {
			changeFileVersion(undefined)
		}
		setIsEditMode(true)
	}, [setIsEditMode, fileVersion, changeFileVersion])

	// 版本切换处理 - 强制退出编辑模式
	const handleVersionChange = useMemoizedFn((version: number | undefined) => {
		if (isEditMode) {
			setIsEditMode(false)
		}
		if (version === undefined) {
			// 回到最新版本
			changeFileVersion(undefined)
		} else {
			// 切换到指定版本
			changeFileVersion(version)
		}
	})

	// 回到最新版本
	const handleReturnLatest = useMemoizedFn(() => {
		handleVersionChange(undefined)
	})

	// Version rollback
	const handleRollback = useMemoizedFn(async (version?: number) => {
		if (!version) return
		try {
			await handleVersionRollback(version)
			// After rollback, update store with the latest content (which is the rolled back content)
			// The hook automatically switches to latest version after rollback
			if (onManualSave) {
				await onManualSave(
					{
						success: true,
						cleanContent: rawContent,
						rawContent: rawContent,
						fileId,
					},
					index,
				)
			}
		} catch (error) {
			console.error("Version rollback failed:", error)
		}
	})

	// 处理版本对比 - 直接获取版本内容不影响主预览
	const handleCompareVersion = useMemoizedFn(async (version: number) => {
		try {
			setCompareHistoryVersion(version)
			// 直接获取版本内容用于对比，不改变当前显示
			const historyContent = await getVersionContentForCompare(version)
			if (historyContent) {
				// 处理历史版本内容
				const processedContent = await processHistoricalContent(historyContent)
				setCompareHistoryContent(processedContent)
				setShowHistoryCompareDialog(true)
			}
		} catch (error) {
			console.error("Failed to load version for comparison:", error)
		}
	})

	// 使用历史版本 - 执行回滚操作
	const handleUseHistoryVersion = useMemoizedFn(async (version: number) => {
		try {
			setShowHistoryCompareDialog(false)
			// 执行回滚操作，将历史版本恢复为最新版本
			await handleVersionRollback(version)

			// 回滚后刷新当前幻灯片内容
			if (onRefreshSlide) {
				await onRefreshSlide(index)
			}

			// 刷新版本列表
			if (fileId) {
				await fetchFileVersions(fileId, true)
			}
		} catch (error) {
			console.error("Failed to rollback to history version:", error)
		}
	})

	// 使用最新版本 - 只关闭对比弹窗，不做任何操作
	const handleUseLatestVersion = useMemoizedFn(() => {
		setShowHistoryCompareDialog(false)
	})

	// 在对比面板中切换历史版本
	const handleSwitchHistoryVersion = useMemoizedFn(async (version: number) => {
		try {
			setCompareHistoryVersion(version)
			// 获取新版本的内容
			const historyContent = await getVersionContentForCompare(version)
			if (historyContent) {
				// 处理历史版本内容
				const processedContent = await processHistoricalContent(historyContent)
				setCompareHistoryContent(processedContent)
			}
		} catch (error) {
			console.error("Failed to switch history version:", error)
		}
	})

	// 执行实际保存操作
	const performSave = useMemoizedFn(async () => {
		setIsSaving(true)
		try {
			if (viewMode === "code") {
				await saveEditContent?.(
					shadow(editingCodeContent),
					fileId,
					true,
					fetchFileVersions,
					true,
				)
				await onManualSave?.(
					{
						success: true,
						cleanContent: editingCodeContent,
						rawContent: content,
						fileId,
					},
					index,
				)
			} else {
				// 触发实际的保存操作
				if (triggerSaveRef) {
					const saveResult = await triggerSaveRef()
					await onManualSave?.(saveResult, index)
				}
			}
			await setIsEditMode(false)
			setShowSaveDialog(false)
			setPendingDeactivate(false)
			// 清除服务端更新标志
			clearServerUpdate()
			setShowSaveWithUpdateConfirmDialog(false)
		} catch (err) {
			console.error("保存失败", err)
		} finally {
			setIsSaving(false)
		}
	})

	// 保存按钮处理
	const handleSave = useCallback(async () => {
		if (isSaving) return

		// 如果有服务端更新，先确认
		if (!checkServerUpdateBeforeSave()) {
			return
		}

		await performSave()
	}, [isSaving, checkServerUpdateBeforeSave, performSave])

	// Register save handler for navigation confirmation
	useSaveHandlerRegistration({
		isEditMode,
		handleSave,
		onRegisterSaveHandler,
	})

	// 取消按钮处理
	const handleCancel = useCallback(() => {
		// 应用服务端更新或恢复原始内容
		applyServerUpdate()
		setIsEditMode(false)
		setShowSaveDialog(false)
		setPendingDeactivate(false)
		clearServerUpdate()
		// 通知父组件可以继续切换
		if (pendingDeactivate) {
			onDeactivate?.()
		}
	}, [pendingDeactivate, onDeactivate, setIsEditMode, applyServerUpdate, clearServerUpdate])

	// 对话框 - 保存并切换
	const handleSaveAndSwitch = useCallback(async () => {
		if (isSaving) return

		setIsSaving(true)
		try {
			// 触发实际的保存操作
			if (triggerSaveRef) {
				const saveResult = await triggerSaveRef()
				await onManualSave?.(saveResult, index)
			}
			// 标记为手动保存并更新缩略图
			await setIsEditMode(false)
			setShowSaveDialog(false)
			setPendingDeactivate(false)
			// 清除服务端更新标志
			clearServerUpdate()
			// 通知父组件可以继续切换
			if (pendingDeactivate) {
				onDeactivate?.()
			}
		} catch (err) {
			console.error("保存失败", err)
		} finally {
			setIsSaving(false)
		}
	}, [
		isSaving,
		triggerSaveRef,
		setIsEditMode,
		pendingDeactivate,
		onDeactivate,
		onManualSave,
		index,
		clearServerUpdate,
	])

	// 对话框 - 不保存，直接切换
	const handleDiscardAndSwitch = useCallback(() => {
		// 应用服务端更新或恢复原始内容
		applyServerUpdate()
		setIsEditMode(false)
		setShowSaveDialog(false)
		setPendingDeactivate(false)
		clearServerUpdate()
		// 通知父组件可以继续切换
		if (pendingDeactivate) {
			onDeactivate?.()
		}
	}, [pendingDeactivate, onDeactivate, setIsEditMode, applyServerUpdate, clearServerUpdate])

	// Handle refresh current slide
	const handleRefresh = useMemoizedFn(async () => {
		if (isRefreshing) return

		setIsRefreshing(true)
		try {
			// Exit edit mode if editing
			if (isEditMode) {
				setIsEditMode(false)
			}

			// If viewing historical version, return to latest
			if (fileVersion) {
				changeFileVersion(undefined)
			}

			// Refresh slide content from server
			if (onRefreshSlide) {
				await onRefreshSlide(index)
			}

			// Refresh version list
			if (fileId) {
				await fetchFileVersions(fileId, true)
			}

			// Clear server update flag
			clearServerUpdate()
		} catch (error) {
			console.error("Failed to refresh slide:", error)
		} finally {
			setIsRefreshing(false)
		}
	})

	const [viewMode, setViewMode] = useState<"code" | "desktop" | "phone">("desktop")
	const [editingCodeContent, setEditingCodeContent] = useState<string>(displayContent.rawContent)

	// 同步 editingCodeContent 和 displayContent
	useEffect(() => {
		setEditingCodeContent(displayContent.rawContent)
	}, [displayContent.rawContent])

	// Construct current file info for sharing - use main PPT file instead of individual slide
	const currentFile = useMemo(() => {
		// Prefer main PPT file for sharing the entire presentation
		if (mainFileId && mainFileName) {
			return {
				id: mainFileId,
				name: mainFileName,
				type: "html",
			}
		}

		// Fallback to individual slide if main file info is not available
		if (!fileId) return undefined

		// Extract file name from relative path or use default
		const fileName = relative_file_path?.split("/").pop() || `slide_${index + 1}.html`

		return {
			id: fileId,
			name: fileName,
			type: "html",
		}
	}, [mainFileId, mainFileName, fileId, relative_file_path, index])

	const renderMainContent = () => {
		if (loadingState === "loading") {
			return (
				<div
					data-testid="ppt-slide-loading"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
						<Loader2 size={64} className="animate-spin text-primary" />
						<div className="text-center">
							<p className="text-lg font-medium">{t("ppt.loading")}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("ppt.slideLoading", { index: index + 1 })}
							</p>
						</div>
					</div>
				</div>
			)
		}

		if (loadingState === "error") {
			return (
				<PPTSlideError
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
					index={index}
					error={loadingError}
					isActive={isActive}
				/>
			)
		}

		if (loadingState === "idle") {
			return (
				<div
					data-testid="ppt-slide-idle"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
						<div className="text-center">
							<p className="text-lg font-medium">{t("ppt.slideIdle")}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("ppt.slideIdleDescription", { index: index + 1 })}
							</p>
						</div>
					</div>
				</div>
			)
		}

		// Empty content fallback UI
		if (!content || content.trim() === "") {
			return (
				<div
					data-testid="ppt-slide-empty"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
						<FileX size={64} className="text-muted-foreground" />
						<div className="text-center">
							<p className="text-lg font-medium">{t("ppt.fileNotFound")}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("ppt.slideContentEmpty", { index: index + 1 })}
							</p>
						</div>
					</div>
				</div>
			)
		}

		return viewMode === "code" ? (
			<CodeEditor
				content={displayContent.rawContent || ""}
				fileName={fileId}
				isEditMode={isEditMode}
				onChange={(value) => setEditingCodeContent(value)}
				height="100%"
				showLineNumbers={true}
			/>
		) : (
			<IsolatedHTMLRenderer
				ref={rendererRef as React.RefObject<IsolatedHTMLRendererRef>}
				content={content}
				sandboxType="iframe"
				isPptRender
				isFullscreen={isFullscreen}
				isEditMode={isEditMode}
				isVisible={isActive}
				isSaving={isSaving}
				saveEditContent={saveEditContent}
				fileId={fileId}
				onSaveReady={handleSaveReady}
				filePathMapping={filePathMapping}
				openNewTab={openNewTab}
				relative_file_path={relative_file_path}
				selectedProject={selectedProject}
				attachmentList={attachmentList}
				setSlideContents={updateSlideContents}
				slideIndex={index}
				isPlaybackMode={isPlaybackMode}
				className="h-[100%-40px]"
			/>
		)
	}

	return (
		<>
			<div
				data-testid={fileId ? `ppt-slide-item-${fileId}` : "ppt-slide-item"}
				className={slideWrapperClassNames}
				style={slideWrapperStyle}
			>
				{showEditToolbar && (
					<EditToolbar
						showAIOptimization={allowEdit && !fileVersion}
						showFileEdit={allowEdit && !fileVersion}
						isEditMode={isEditMode}
						isSaving={isSaving}
						attachmentList={attachmentList}
						fileId={fileId}
						mainFileId={mainFileId}
						onEdit={handleEdit}
						onSave={handleSave}
						onCancel={handleCancel}
						hasServerUpdate={hasServerUpdate}
						onViewServerUpdate={handleViewServerUpdate}
						viewMode={viewMode}
						onViewModeChange={setViewMode}
						showVersionHistory={allowEdit}
						fileVersion={fileVersion}
						fileVersionsList={fileVersionsList}
						isNewestVersion={isNewestVersion}
						onVersionChange={handleVersionChange}
						onVersionRollback={handleRollback}
						onCompareVersion={handleCompareVersion}
						fetchFileVersions={fetchFileVersions}
						shouldShowButtonText={showButtonText}
						showRefresh={!isShareRoute}
						onRefresh={handleRefresh}
						isRefreshing={isRefreshing}
						currentFile={currentFile}
						attachments={attachments}
						showShare={allowEdit}
						allowShare={isNewestVersion && !fileVersion}
						showDownload={!isShareRoute}
						className="max-w-full flex-shrink-0 overflow-x-auto bg-white dark:bg-card"
						style={{
							visibility: isActive ? "visible" : "hidden",
							pointerEvents: isActive ? "auto" : "none",
						}}
					/>
				)}

				{renderMainContent()}
			</div>

			{/* 保存提示对话框 */}
			<AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
				<AlertDialogContent data-testid="ppt-slide-save-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.unsavedChangesTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.unsavedChangesDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							data-testid="ppt-slide-save-dialog-discard"
							onClick={handleDiscardAndSwitch}
							disabled={isSaving}
						>
							{t("ppt.discardChanges")}
						</AlertDialogCancel>
						<AlertDialogAction
							data-testid="ppt-slide-save-dialog-save"
							onClick={handleSaveAndSwitch}
							disabled={isSaving}
						>
							{isSaving ? t("ppt.saving") : t("ppt.saveChanges")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 保存时服务端更新确认对话框 */}
			<AlertDialog
				open={showSaveWithUpdateConfirmDialog}
				onOpenChange={setShowSaveWithUpdateConfirmDialog}
			>
				<AlertDialogContent data-testid="ppt-slide-save-with-update-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.saveWithServerUpdateTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.saveWithServerUpdate")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isSaving}>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={performSave} disabled={isSaving}>
							{isSaving ? t("ppt.saving") : t("ppt.saveChanges")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 版本对比对话框 */}
			<VersionCompareDialog
				open={showVersionCompareDialog}
				onOpenChange={setShowVersionCompareDialog}
				currentContent={currentEditingContent}
				serverContent={actualServerContent}
				onUseMyVersion={handleUseMyVersion}
				onUseServerVersion={handleUseServerVersion}
				filePathMapping={filePathMapping}
				fileId={fileId}
				openNewTab={openNewTab}
				selectedProject={selectedProject}
				attachmentList={attachmentList}
			/>

			{/* 历史版本对比对话框 */}
			{compareHistoryVersion && (
				<HistoryVersionCompareDialog
					open={showHistoryCompareDialog}
					onOpenChange={setShowHistoryCompareDialog}
					latestContent={content}
					historyContent={compareHistoryContent}
					historyVersion={compareHistoryVersion}
					fileVersionsList={fileVersionsList}
					onUseHistoryVersion={handleUseHistoryVersion}
					onUseLatestVersion={handleUseLatestVersion}
					onSwitchHistoryVersion={handleSwitchHistoryVersion}
					filePathMapping={filePathMapping}
					fileId={fileId}
					openNewTab={openNewTab}
					selectedProject={selectedProject}
					attachmentList={attachmentList}
				/>
			)}
		</>
	)
})

export default PPTSlide
