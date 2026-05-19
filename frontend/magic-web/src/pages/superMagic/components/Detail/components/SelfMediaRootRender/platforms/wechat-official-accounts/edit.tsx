import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
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
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../../../contents/HTML/IsolatedHTMLRenderer"
import type { SaveResult } from "../../../../contents/HTML/iframe-bridge/types/props"
import { processHtmlContent } from "../../../../contents/HTML/htmlProcessor"
import { flattenAttachments } from "../../../../contents/HTML/utils"
import type { FileItem } from "../../../../contents/HTML/utils/fetchInterceptor"
import useEditMode from "../../../../hooks/useEditMode"
import { invalidateCardFrameSourceCache } from "../../components/CardFrame"
import { CARD_IMAGE_PROCESS } from "../../constants/imageProcess"
import type { PlatformComponentProps, SelfMediaPost, SelfMediaView } from "../../types"
import { RednoteEditRefreshConfirmDialog } from "../rednote/RednoteEditRefreshConfirmDialog"
import { RednoteEditSaveStatusIndicator } from "../rednote/RednoteEditSaveStatusIndicator"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface WechatEditViewProps {
	post: SelfMediaPost
	attachmentList?: PlatformComponentProps["attachmentList"]
	saveEditContent?: PlatformComponentProps["saveEditContent"]
	selectedProject?: unknown
	onChangePost: (idx: number) => void
	onChangeView?: (view: SelfMediaView) => void
	onEditingStateChange?: (editing: boolean) => void
	onRequestViewChangeReady?: (handler: ((nextView: SelfMediaView) => void) | null) => void
	onRequestPostChangeReady?: (handler: ((nextPostIndex: number) => void) | null) => void
	onRequestRefreshCurrentPostReady?: (handler: (() => void) | null) => void
}

function getFileFolderPath(
	file: Pick<FileItem, "file_name" | "relative_file_path"> | null,
): string {
	const path = file?.relative_file_path || ""
	if (!path) return "/"
	if (file?.file_name && path.endsWith(file.file_name)) {
		return path.slice(0, -file.file_name.length)
	}
	const slashIndex = path.lastIndexOf("/")
	return slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "/"
}

function WechatEditView({
	post,
	attachmentList,
	saveEditContent,
	selectedProject,
	onChangePost,
	onChangeView,
	onEditingStateChange,
	onRequestViewChangeReady,
	onRequestPostChangeReady,
	onRequestRefreshCurrentPostReady,
}: WechatEditViewProps) {
	const { t } = useTranslation("super")
	const article = post.article
	const fileId = article?.fileId

	const [content, setContent] = useState<string | null>(null)
	const [contentLoading, setContentLoading] = useState(false)
	const [contentError, setContentError] = useState<string | null>(null)
	const loadedFileIdRef = useRef<string | null>(null)

	const { isEditMode, setIsEditMode } = useEditMode({ fileId })
	const rendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const [triggerSaveRef, setTriggerSaveRef] = useState<
		(() => Promise<SaveResult | undefined>) | null
	>(null)
	const [isSaving, setIsSaving] = useState(false)

	const isDirtyRef = useRef(false)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
	const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [showSaveRetryDialog, setShowSaveRetryDialog] = useState(false)
	const [showUnsavedNavDialog, setShowUnsavedNavDialog] = useState(false)
	const [showRefreshConfirmDialog, setShowRefreshConfirmDialog] = useState(false)
	const pendingActionRef = useRef<(() => void) | null>(null)

	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const [contentReloadVersion, setContentReloadVersion] = useState(0)

	const setDirtyState = useCallback((nextDirty: boolean) => {
		isDirtyRef.current = nextDirty
		setHasUnsavedChanges((prev) => (prev === nextDirty ? prev : nextDirty))
	}, [])

	const flattenedFiles = useMemo(
		() =>
			(attachmentList?.length ? flattenAttachments(attachmentList) : []).filter(
				(item): item is FileItem =>
					Boolean(item?.file_id) &&
					Boolean(item?.relative_file_path) &&
					!item?.is_directory,
			),
		[attachmentList],
	)

	const currentFile = useMemo(
		() => flattenedFiles.find((item) => item.file_id === fileId) || null,
		[flattenedFiles, fileId],
	)
	const relativeFolderPath = useMemo(() => getFileFolderPath(currentFile), [currentFile])

	useEffect(() => {
		let cancelled = false
		if (!fileId) {
			setContent(null)
			setContentError(null)
			loadedFileIdRef.current = null
			return
		}

		// Avoid reloading when already editing the same file
		if (isEditMode && loadedFileIdRef.current === fileId && content) return

		setContentLoading(true)
		setContentError(null)
		setContent(null)
		;(async () => {
			try {
				const urls = await getTemporaryDownloadUrl({ file_ids: [fileId] })
				const url = urls?.[0]?.url
				if (!url) throw new Error("noArticleUrl")
				if (cancelled) return

				const resp = await fetch(url, { credentials: "omit" })
				if (!resp.ok) throw new Error("loadArticleError")
				const html = await resp.text()
				if (cancelled) return

				let processedContent = html
				let mapping = new Map<string, string>()
				if (attachmentList?.length) {
					const result = await processHtmlContent({
						content: html,
						attachments: attachmentList,
						attachmentList,
						fileId,
						fileName: currentFile?.file_name,
						html_relative_path: relativeFolderPath,
						xMagicImageProcess: CARD_IMAGE_PROCESS,
					})
					processedContent = result.processedContent || html
					mapping = result.filePathMapping || new Map()
				}
				if (cancelled) return

				setContent(processedContent)
				setFilePathMapping(mapping)
				loadedFileIdRef.current = fileId
			} catch (err) {
				if (cancelled) return
				setContentError(err instanceof Error ? err.message : "unknownError")
			} finally {
				if (!cancelled) setContentLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
		// Intentionally exclude isEditMode & content to avoid re-fetch during editing
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId, attachmentList, contentReloadVersion, currentFile?.file_name, relativeFolderPath])

	useEffect(() => {
		if (content && fileId && !isEditMode) {
			setIsEditMode(true)
		}
	}, [content, fileId, isEditMode, setIsEditMode])

	useEffect(() => {
		onEditingStateChange?.(hasUnsavedChanges)
	}, [hasUnsavedChanges, onEditingStateChange])

	const handleSaveReady = useCallback((triggerSave: () => Promise<SaveResult | undefined>) => {
		setTriggerSaveRef(() => triggerSave)
	}, [])

	const runPendingAction = useCallback(() => {
		pendingActionRef.current?.()
		pendingActionRef.current = null
	}, [])

	const clearPendingAction = useCallback(() => {
		pendingActionRef.current = null
	}, [])

	const executeSave = useMemoizedFn(async (): Promise<boolean> => {
		if (!triggerSaveRef) return false
		setIsSaving(true)
		setSaveStatus("saving")
		if (savedTimerRef.current) {
			clearTimeout(savedTimerRef.current)
			savedTimerRef.current = null
		}
		try {
			const saveResult = await triggerSaveRef()
			const success = saveResult?.success !== false
			if (success) invalidateCardFrameSourceCache(fileId)
			if (success) setDirtyState(false)
			setSaveStatus(success ? "saved" : "error")
			savedTimerRef.current = setTimeout(() => {
				setSaveStatus("idle")
				savedTimerRef.current = null
			}, 2000)
			return success
		} catch {
			setSaveStatus("error")
			savedTimerRef.current = setTimeout(() => {
				setSaveStatus("idle")
				savedTimerRef.current = null
			}, 3000)
			return false
		} finally {
			setIsSaving(false)
		}
	})

	const runNavigationAfterSave = useMemoizedFn(async (action: () => void) => {
		if (!isEditMode || !isDirtyRef.current) {
			action()
			return
		}
		pendingActionRef.current = () => {
			setDirtyState(false)
			setIsEditMode(false)
			action()
		}
		// Show confirm dialog instead of auto-saving
		setShowUnsavedNavDialog(true)
	})

	const reloadArticle = useMemoizedFn(() => {
		loadedFileIdRef.current = null
		setContentError(null)
		setContent(null)
		setContentReloadVersion((prev) => prev + 1)
	})

	const refreshCurrentPost = useMemoizedFn(() => {
		invalidateCardFrameSourceCache(fileId)
		reloadArticle()
	})

	const runRefreshAfterGuard = useMemoizedFn((action: () => void) => {
		if (!isEditMode || !isDirtyRef.current) {
			action()
			return
		}
		pendingActionRef.current = action
		setShowRefreshConfirmDialog(true)
	})

	useEffect(() => {
		if (!isEditMode) return

		const handleMessage = (event: MessageEvent) => {
			try {
				const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
				if (
					data?.type === "CONTENT_CHANGED" &&
					typeof data?.payload?.hasChanges === "boolean"
				) {
					const nextDirty = data.payload.hasChanges
					setDirtyState(nextDirty)
				}
			} catch {
				// Ignore non-JSON messages
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [isEditMode, setDirtyState])

	useEffect(() => {
		return () => {
			if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
		}
	}, [])

	useEffect(() => {
		loadedFileIdRef.current = null
		setDirtyState(false)
	}, [fileId, setDirtyState])

	const handleRequestViewChange = useMemoizedFn(async (nextView: SelfMediaView) => {
		if (!onChangeView || nextView === "edit") {
			onChangeView?.(nextView)
			return
		}
		await runNavigationAfterSave(() => {
			onChangeView(nextView)
		})
	})

	useEffect(() => {
		onRequestViewChangeReady?.(handleRequestViewChange)
		return () => {
			onRequestViewChangeReady?.(null)
		}
	}, [handleRequestViewChange, onRequestViewChangeReady])

	const handleRequestPostChange = useMemoizedFn(async (nextPostIndex: number) => {
		await runNavigationAfterSave(() => {
			onChangePost(nextPostIndex)
		})
	})

	useEffect(() => {
		onRequestPostChangeReady?.(handleRequestPostChange)
		return () => {
			onRequestPostChangeReady?.(null)
		}
	}, [handleRequestPostChange, onRequestPostChangeReady])

	const handleRequestRefreshCurrentPost = useMemoizedFn(() => {
		runRefreshAfterGuard(refreshCurrentPost)
	})

	useEffect(() => {
		onRequestRefreshCurrentPostReady?.(handleRequestRefreshCurrentPost)
		return () => {
			onRequestRefreshCurrentPostReady?.(null)
		}
	}, [handleRequestRefreshCurrentPost, onRequestRefreshCurrentPostReady])

	const handleRetryFailedSave = useCallback(async () => {
		const saved = await executeSave()
		if (saved) {
			setShowSaveRetryDialog(false)
			runPendingAction()
		}
	}, [executeSave, runPendingAction])

	const handleDiscardAfterFailedSave = useCallback(() => {
		setShowSaveRetryDialog(false)
		setDirtyState(false)
		reloadArticle()
		runPendingAction()
	}, [runPendingAction, setDirtyState, reloadArticle])

	// ===== Unsaved nav dialog handlers =====
	const handleSaveBeforeNav = useCallback(async () => {
		setShowUnsavedNavDialog(false)
		const saved = await executeSave()
		if (saved) {
			runPendingAction()
			return
		}
		setShowSaveRetryDialog(true)
	}, [executeSave, runPendingAction])

	const handleDiscardBeforeNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		setDirtyState(false)
		reloadArticle()
		runPendingAction()
	}, [runPendingAction, setDirtyState, reloadArticle])

	const handleCancelNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		clearPendingAction()
	}, [clearPendingAction])

	const handleCancelEdit = useCallback(() => {
		setDirtyState(false)
		reloadArticle()
	}, [setDirtyState, reloadArticle])

	const handleSaveBeforeRefresh = useCallback(async () => {
		const saved = await executeSave()
		if (saved) {
			setShowRefreshConfirmDialog(false)
			runPendingAction()
			return
		}
		setShowRefreshConfirmDialog(false)
		setShowSaveRetryDialog(true)
	}, [executeSave, runPendingAction])

	const handleDiscardBeforeRefresh = useCallback(() => {
		setShowRefreshConfirmDialog(false)
		setDirtyState(false)
		runPendingAction()
	}, [runPendingAction, setDirtyState])

	const handleCancelRefreshConfirm = useCallback(() => {
		setShowRefreshConfirmDialog(false)
		clearPendingAction()
	}, [clearPendingAction])

	const openNewTab = useCallback(() => {
		// No-op in edit view context
	}, [])

	if (!fileId) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-edit-empty"
			>
				{t("detail.selfMedia.edit.noCards")}
			</div>
		)
	}

	return (
		<div className="flex h-full" data-testid="wechat-edit-view">
			<div className="relative flex-1 overflow-hidden">
				{/* Manual save toolbar — shown when there are unsaved changes */}
				{hasUnsavedChanges ? (
					<div className="absolute right-3 top-[42px] z-50 flex items-center gap-1 rounded-lg px-2 py-1">
						<FileEditButtons
							isEditMode
							isSaving={isSaving}
							showButtonText
							onSave={async () => {
								await executeSave()
							}}
							onCancel={handleCancelEdit}
						/>
					</div>
				) : (
					<RednoteEditSaveStatusIndicator status={saveStatus} />
				)}

				{contentLoading ? (
					<div
						className="flex h-full items-center justify-center text-sm text-muted-foreground"
						data-testid="wechat-edit-loading"
					>
						{t("detail.selfMedia.common.loading")}
					</div>
				) : contentError ? (
					<div
						className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
						data-testid="wechat-edit-error"
					>
						{contentError}
					</div>
				) : content ? (
					<div className="h-full w-full" data-testid="wechat-edit-renderer-shell">
						<IsolatedHTMLRenderer
							ref={rendererRef as React.RefObject<IsolatedHTMLRendererRef>}
							content={content}
							sandboxType="iframe"
							isEditMode={isEditMode}
							isSaving={isSaving}
							saveEditContent={saveEditContent}
							fileId={fileId}
							onSaveReady={handleSaveReady}
							filePathMapping={filePathMapping}
							openNewTab={openNewTab}
							relative_file_path={currentFile?.relative_file_path}
							selectedProject={selectedProject}
							attachmentList={attachmentList}
							isVisible
							// toolbarClassName="absolute left-1/2 top-2 z-[10] -translate-x-1/2 w-[98%] rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60"
							className="h-full w-full"
						/>
					</div>
				) : (
					<div
						className="flex h-full items-center justify-center text-sm text-muted-foreground"
						data-testid="wechat-edit-no-content"
					>
						{t("detail.selfMedia.common.noPosts")}
					</div>
				)}
			</div>

			<AlertDialog open={showUnsavedNavDialog}>
				<AlertDialogContent data-testid="wechat-edit-unsaved-nav-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("detail.selfMedia.edit.unsavedTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("detail.selfMedia.edit.unsavedDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={handleCancelNav}
							data-testid="wechat-edit-unsaved-nav-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							onClick={handleDiscardBeforeNav}
							data-testid="wechat-edit-unsaved-nav-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							onClick={handleSaveBeforeNav}
							data-testid="wechat-edit-unsaved-nav-save-btn"
						>
							{t("detail.selfMedia.edit.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog open={showSaveRetryDialog}>
				<AlertDialogContent data-testid="wechat-edit-save-retry-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("detail.selfMedia.edit.saveFailed")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("detail.selfMedia.edit.saveFailedDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction
							variant="outline"
							onClick={handleDiscardAfterFailedSave}
							data-testid="wechat-edit-failed-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							onClick={handleRetryFailedSave}
							data-testid="wechat-edit-failed-retry-btn"
						>
							{t("detail.selfMedia.edit.retry")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<RednoteEditRefreshConfirmDialog
				open={showRefreshConfirmDialog}
				onSave={handleSaveBeforeRefresh}
				onDiscard={handleDiscardBeforeRefresh}
				onCancel={handleCancelRefreshConfirm}
			/>
		</div>
	)
}

export default memo(WechatEditView)
