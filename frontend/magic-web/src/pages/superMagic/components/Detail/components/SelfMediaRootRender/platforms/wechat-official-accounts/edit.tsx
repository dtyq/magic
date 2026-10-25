import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
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
import { selfMediaOverlayStyles } from "../../components/selfMediaOverlayStyles"
import { usePendingActionGuard } from "../../../../utils/usePendingActionGuard"

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
	const fileApi = useFileApi()
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
	const saveRetryTargetRef = useRef<"navigation" | "refresh" | null>(null)

	const [htmlToolbarEndHost, setHtmlToolbarEndHost] = useState<HTMLDivElement | null>(null)
	const onHtmlToolbarEndRef = useCallback((el: HTMLDivElement | null) => {
		setHtmlToolbarEndHost(el)
	}, [])

	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const [contentReloadVersion, setContentReloadVersion] = useState(0)

	const setDirtyState = useCallback((nextDirty: boolean) => {
		isDirtyRef.current = nextDirty
		setHasUnsavedChanges((prev) => (prev === nextDirty ? prev : nextDirty))
	}, [])

	const shouldBlockPendingAction = useCallback(
		() => isEditMode && isDirtyRef.current,
		[isEditMode],
	)
	const handleNavigationBlocked = useCallback(() => {
		setShowUnsavedNavDialog(true)
	}, [])
	const handleRefreshBlocked = useCallback(() => {
		setShowRefreshConfirmDialog(true)
	}, [])
	const navigationGuard = usePendingActionGuard({
		shouldBlock: shouldBlockPendingAction,
		onBlocked: handleNavigationBlocked,
	})
	const refreshGuard = usePendingActionGuard({
		shouldBlock: shouldBlockPendingAction,
		onBlocked: handleRefreshBlocked,
	})
	const {
		run: runNavigation,
		resolve: resolveNavigation,
		cancel: cancelNavigation,
	} = navigationGuard
	const { run: runRefresh, resolve: resolveRefresh, cancel: cancelRefresh } = refreshGuard

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
				const urls = await fileApi.getTemporaryDownloadUrl({ file_ids: [fileId] })
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
						fileApi,
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
	}, [
		fileId,
		attachmentList,
		contentReloadVersion,
		currentFile?.file_name,
		relativeFolderPath,
		fileApi,
	])

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
			return true
		}

		return runNavigation(() => {
			setDirtyState(false)
			setIsEditMode(false)
			action()
		}, undefined)
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
		return runRefresh(action, undefined)
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
			const target = saveRetryTargetRef.current
			saveRetryTargetRef.current = null
			if (target === "navigation") await resolveNavigation(true)
			if (target === "refresh") await resolveRefresh(true)
		}
	}, [executeSave, resolveNavigation, resolveRefresh])

	const handleDiscardAfterFailedSave = useCallback(() => {
		setShowSaveRetryDialog(false)
		setDirtyState(false)
		const target = saveRetryTargetRef.current
		saveRetryTargetRef.current = null
		if (target === "navigation") {
			reloadArticle()
			void resolveNavigation(true)
		}
		if (target === "refresh") void resolveRefresh(true)
	}, [reloadArticle, resolveNavigation, resolveRefresh, setDirtyState])

	// ===== Unsaved nav dialog handlers =====
	const handleSaveBeforeNav = useCallback(async () => {
		setShowUnsavedNavDialog(false)
		const saved = await executeSave()
		if (saved) {
			await resolveNavigation(true)
			return
		}
		saveRetryTargetRef.current = "navigation"
		setShowSaveRetryDialog(true)
	}, [executeSave, resolveNavigation])

	const handleDiscardBeforeNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		setDirtyState(false)
		reloadArticle()
		void resolveNavigation(true)
	}, [reloadArticle, resolveNavigation, setDirtyState])

	const handleCancelNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		cancelNavigation()
	}, [cancelNavigation])

	const handleCancelEdit = useCallback(() => {
		setDirtyState(false)
		reloadArticle()
	}, [setDirtyState, reloadArticle])

	const handleSaveBeforeRefresh = useCallback(async () => {
		const saved = await executeSave()
		if (saved) {
			setShowRefreshConfirmDialog(false)
			await resolveRefresh(true)
			return
		}
		setShowRefreshConfirmDialog(false)
		saveRetryTargetRef.current = "refresh"
		setShowSaveRetryDialog(true)
	}, [executeSave, resolveRefresh])

	const handleDiscardBeforeRefresh = useCallback(() => {
		setShowRefreshConfirmDialog(false)
		setDirtyState(false)
		void resolveRefresh(true)
	}, [resolveRefresh, setDirtyState])

	const handleCancelRefreshConfirm = useCallback(() => {
		setShowRefreshConfirmDialog(false)
		cancelRefresh()
	}, [cancelRefresh])

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
							htmlRelativeFolderPath={relativeFolderPath}
							selectedProject={selectedProject}
							attachmentList={attachmentList}
							isVisible
							toolbarEndRef={onHtmlToolbarEndRef}
							className="h-full w-full"
						/>
						{htmlToolbarEndHost && content
							? createPortal(
									hasUnsavedChanges ? (
										<FileEditButtons
											testIdPrefix="wechat-edit"
											isEditMode
											isSaving={isSaving}
											showButtonText
											onSave={async () => {
												await executeSave()
											}}
											onCancel={handleCancelEdit}
										/>
									) : (
										<RednoteEditSaveStatusIndicator
											status={saveStatus}
											inline
										/>
									),
									htmlToolbarEndHost,
								)
							: null}
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
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="wechat-edit-unsaved-nav-dialog"
				>
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
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleCancelNav}
							data-testid="wechat-edit-unsaved-nav-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleDiscardBeforeNav}
							data-testid="wechat-edit-unsaved-nav-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleSaveBeforeNav}
							data-testid="wechat-edit-unsaved-nav-save-btn"
						>
							{t("detail.selfMedia.edit.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog open={showSaveRetryDialog}>
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="wechat-edit-save-retry-dialog"
				>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("detail.selfMedia.edit.saveFailed")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("detail.selfMedia.edit.saveFailedDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleDiscardAfterFailedSave}
							data-testid="wechat-edit-failed-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
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
