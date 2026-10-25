import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
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
import { useSelfMediaStore } from "../../stores"
import type { PlatformComponentProps, SelfMediaAttachmentNode, SelfMediaView } from "../../types"
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
import { RednoteEditRefreshConfirmDialog } from "./RednoteEditRefreshConfirmDialog"
import { RednoteEditThumbnailSidebar } from "./RednoteEditThumbnailSidebar"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import { resolveSelfMediaCardScaleContentDimensions } from "../../utils/selfMediaCardDimensions"
import { selfMediaOverlayStyles } from "../../components/selfMediaOverlayStyles"
import { usePendingActionGuard } from "../../../../utils/usePendingActionGuard"

interface RednoteEditViewProps {
	attachmentList?: PlatformComponentProps["attachmentList"]
	saveEditContent?: PlatformComponentProps["saveEditContent"]
	selectedProject?: unknown
	/** Expose unsaved-change state to parent */
	onEditingStateChange?: (editing: boolean) => void
	onRequestViewChangeReady?: (handler: ((nextView: SelfMediaView) => void) | null) => void
	onRequestPostChangeReady?: (handler: ((nextPostIndex: number) => void) | null) => void
	onRequestRefreshCurrentPostReady?: (handler: (() => void) | null) => void
	/** Full data reload (toolbar refresh); may prompt when unsaved in edit. */
	onShellDataReload?: () => void
	onRequestShellDataReloadReady?: (handler: (() => void) | null) => void
	onAddCardToCurrentChat?: (index: number) => void
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

const RednoteEditView = observer(function RednoteEditView({
	attachmentList,
	saveEditContent,
	selectedProject,
	onEditingStateChange,
	onRequestViewChangeReady,
	onRequestPostChangeReady,
	onRequestRefreshCurrentPostReady,
	onShellDataReload,
	onRequestShellDataReloadReady,
	onAddCardToCurrentChat,
}: RednoteEditViewProps) {
	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const store = useSelfMediaStore()
	const { activePost, activeCardIndex } = store
	const cards = activePost?.cards ?? []
	const activeCard = cards[activeCardIndex]

	const onChangeCard = useCallback(
		(idx: number) => {
			store.setActiveCardIndex(idx)
		},
		[store],
	)
	const onChangePost = useCallback(
		(idx: number) => {
			store.setActivePostIndex(idx)
		},
		[store],
	)
	const onChangeView = useCallback(
		(nextView: SelfMediaView) => {
			store.setView(nextView)
		},
		[store],
	)

	// ===== Content loading =====
	const [cardContent, setCardContent] = useState<string | null>(null)
	const [contentLoading, setContentLoading] = useState(false)
	const [contentError, setContentError] = useState<string | null>(null)
	const scaleContentDimensions = useMemo(
		() => resolveSelfMediaCardScaleContentDimensions(store.resolvedPlatform, cardContent),
		[cardContent, store.resolvedPlatform],
	)
	// Track loaded fileId to prevent server-side content refreshes from flickering
	const loadedFileIdRef = useRef<string | null>(null)

	// ===== Edit state =====
	const { isEditMode, setIsEditMode } = useEditMode({
		fileId: activeCard?.fileId,
	})
	const rendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const [triggerSaveRef, setTriggerSaveRef] = useState<
		(() => Promise<SaveResult | undefined>) | null
	>(null)
	const [isSaving, setIsSaving] = useState(false)

	// ===== Dirty tracking (has user actually edited?) =====
	const isDirtyRef = useRef(false)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

	const [showSaveRetryDialog, setShowSaveRetryDialog] = useState(false)
	const [showUnsavedNavDialog, setShowUnsavedNavDialog] = useState(false)
	const [showRefreshConfirmDialog, setShowRefreshConfirmDialog] = useState(false)
	const [showVersionHistoryGuardDialog, setShowVersionHistoryGuardDialog] = useState(false)
	const saveRetryTargetRef = useRef<"navigation" | "refresh" | null>(null)

	// ===== File path mapping =====
	const [htmlToolbarEndHost, setHtmlToolbarEndHost] = useState<HTMLDivElement | null>(null)
	const onHtmlToolbarEndRef = useCallback((el: HTMLDivElement | null) => {
		setHtmlToolbarEndHost(el)
	}, [])

	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const [contentReloadVersion, setContentReloadVersion] = useState(0)
	const [postRefreshVersion, setPostRefreshVersion] = useState(0)
	const [cardRefreshVersions, setCardRefreshVersions] = useState<Record<number, number>>({})

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
	const handleVersionHistoryBlocked = useCallback(() => {
		setShowVersionHistoryGuardDialog(true)
	}, [])

	const navigationGuard = usePendingActionGuard({
		shouldBlock: shouldBlockPendingAction,
		onBlocked: handleNavigationBlocked,
	})
	const refreshGuard = usePendingActionGuard({
		shouldBlock: shouldBlockPendingAction,
		onBlocked: handleRefreshBlocked,
	})
	const versionHistoryGuard = usePendingActionGuard({
		shouldBlock: shouldBlockPendingAction,
		onBlocked: handleVersionHistoryBlocked,
	})
	const {
		run: runNavigation,
		resolve: resolveNavigation,
		cancel: cancelNavigation,
	} = navigationGuard
	const { run: runRefresh, resolve: resolveRefresh, cancel: cancelRefresh } = refreshGuard
	const {
		run: runVersionHistory,
		resolve: resolveVersionHistory,
		cancel: cancelVersionHistory,
	} = versionHistoryGuard

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
		() => flattenedFiles.find((item) => item.file_id === activeCard?.fileId) || null,
		[flattenedFiles, activeCard?.fileId],
	)

	const relativeFolderPath = useMemo(() => getFileFolderPath(currentFile), [currentFile])

	// ===== Load card content =====
	useEffect(() => {
		let cancelled = false
		const fileId = activeCard?.fileId
		if (!fileId) {
			setCardContent(null)
			setContentError(null)
			loadedFileIdRef.current = null
			return
		}

		// Prevent reloading if we're in edit mode and the same file is already loaded
		// This avoids flickering when server-side content updates trigger re-renders
		if (isEditMode && loadedFileIdRef.current === fileId && cardContent) return

		setContentLoading(true)
		setContentError(null)
		setCardContent(null)
		;(async () => {
			try {
				const urls = await fileApi.getTemporaryDownloadUrl({ file_ids: [fileId] })
				const url = urls?.[0]?.url
				if (!url) throw new Error("noCardUrl")
				if (cancelled) return

				const resp = await fetch(url, { credentials: "omit" })
				if (!resp.ok) throw new Error("loadCardError")
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

				setCardContent(processedContent)
				setFilePathMapping(mapping)
				loadedFileIdRef.current = fileId
			} catch (err) {
				if (cancelled) return
				const message = err instanceof Error ? err.message : "unknownError"
				setContentError(message)
			} finally {
				if (!cancelled) setContentLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
		// Intentionally exclude isEditMode and cardContent from deps to prevent
		// re-fetching during editing. Content reloads only when fileId changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		activeCard?.fileId,
		attachmentList,
		contentReloadVersion,
		currentFile?.file_name,
		relativeFolderPath,
		fileApi,
	])

	// ===== Auto-enter edit mode when content is loaded =====
	useEffect(() => {
		if (cardContent && activeCard?.fileId && !isEditMode) {
			setIsEditMode(true)
		}
	}, [activeCard?.fileId, cardContent, isEditMode, setIsEditMode])

	// ===== Notify parent of unsaved changes =====
	useEffect(() => {
		onEditingStateChange?.(hasUnsavedChanges)
	}, [hasUnsavedChanges, onEditingStateChange])

	// ===== Save handler registration =====
	const handleSaveReady = useCallback((triggerSave: () => Promise<SaveResult | undefined>) => {
		setTriggerSaveRef(() => triggerSave)
	}, [])

	const runNavigationAfterSave = useMemoizedFn((action: () => void) => {
		if (!isEditMode || !isDirtyRef.current) {
			action()
			return Promise.resolve(true)
		}

		return runNavigation(() => {
			setDirtyState(false)
			setIsEditMode(false)
			action()
		}, undefined)
	})

	// ===== Execute save =====
	const executeSave = useMemoizedFn(async (): Promise<boolean> => {
		if (!triggerSaveRef) return false
		setIsSaving(true)
		try {
			const saveResult = await triggerSaveRef()
			const success = saveResult?.success !== false
			if (success) invalidateCardFrameSourceCache(activeCard?.fileId)
			if (success) setDirtyState(false)
			return success
		} catch {
			return false
		} finally {
			setIsSaving(false)
		}
	})

	const reloadActiveCardContent = useMemoizedFn(() => {
		loadedFileIdRef.current = null
		setContentError(null)
		setCardContent(null)
		setContentReloadVersion((prev) => prev + 1)
	})

	const bumpCardRefreshVersion = useMemoizedFn((targetIndex: number) => {
		setCardRefreshVersions((prev) => ({
			...prev,
			[targetIndex]: (prev[targetIndex] || 0) + 1,
		}))
	})

	const refreshCardByIndex = useMemoizedFn((targetIndex: number) => {
		const targetCard = cards[targetIndex]
		if (!targetCard) return

		invalidateCardFrameSourceCache(targetCard.fileId)
		bumpCardRefreshVersion(targetIndex)
		if (targetIndex === activeCardIndex) reloadActiveCardContent()
	})

	const refreshCurrentPostCards = useMemoizedFn(() => {
		cards.forEach((card) => {
			invalidateCardFrameSourceCache(card.fileId)
		})
		setPostRefreshVersion((prev) => prev + 1)
		reloadActiveCardContent()
	})

	const runRefreshAfterGuard = useMemoizedFn((action: () => void) =>
		runRefresh(action, undefined),
	)

	// ===== Auto-save with throttle =====
	// (removed — manual save only via FileEditButtons)

	// Listen to CONTENT_CHANGED messages from the iframe editor
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

	// Reset loaded file id and dirty state when switching cards
	useEffect(() => {
		loadedFileIdRef.current = null
		setDirtyState(false)
	}, [activeCardIndex, setDirtyState])

	// ===== Guard: auto-save before switching card =====
	const guardedSwitchCard = useMemoizedFn(async (targetIndex: number) => {
		if (targetIndex === activeCardIndex) return
		await runNavigationAfterSave(() => {
			onChangeCard(targetIndex)
		})
	})

	const handleRequestViewChange = useMemoizedFn(async (nextView: SelfMediaView) => {
		if (nextView === "edit") {
			onChangeView(nextView)
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
		runRefreshAfterGuard(refreshCurrentPostCards)
	})

	useEffect(() => {
		onRequestRefreshCurrentPostReady?.(handleRequestRefreshCurrentPost)
		return () => {
			onRequestRefreshCurrentPostReady?.(null)
		}
	}, [handleRequestRefreshCurrentPost, onRequestRefreshCurrentPostReady])

	const handleRequestShellDataReload = useMemoizedFn(() => {
		runRefreshAfterGuard(() => {
			onShellDataReload?.()
		})
	})

	useEffect(() => {
		onRequestShellDataReloadReady?.(handleRequestShellDataReload)
		return () => {
			onRequestShellDataReloadReady?.(null)
		}
	}, [handleRequestShellDataReload, onRequestShellDataReloadReady, onShellDataReload])

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
		if (target === "navigation") void resolveNavigation(true)
		if (target === "refresh") void resolveRefresh(true)
	}, [resolveNavigation, resolveRefresh, setDirtyState])

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
		void resolveNavigation(true)
	}, [resolveNavigation, setDirtyState])

	const handleCancelNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		cancelNavigation()
	}, [cancelNavigation])

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

	const handleCancelEdit = useCallback(() => {
		setDirtyState(false)
		reloadActiveCardContent()
	}, [setDirtyState, reloadActiveCardContent])

	// ===== Version history guard (ask save before opening history dropdown) =====
	const handleBeforeVersionHistoryOpen = useMemoizedFn((): Promise<boolean> => {
		return runVersionHistory(async () => undefined, undefined)
	})

	const handleVersionHistoryGuardSave = useCallback(async () => {
		setShowVersionHistoryGuardDialog(false)
		const saved = await executeSave()
		await resolveVersionHistory(saved)
	}, [executeSave, resolveVersionHistory])

	const handleVersionHistoryGuardDiscard = useCallback(() => {
		setShowVersionHistoryGuardDialog(false)
		setDirtyState(false)
		reloadActiveCardContent()
		void resolveVersionHistory(true)
	}, [reloadActiveCardContent, resolveVersionHistory, setDirtyState])

	const handleVersionHistoryGuardCancel = useCallback(() => {
		setShowVersionHistoryGuardDialog(false)
		cancelVersionHistory()
	}, [cancelVersionHistory])

	// ===== No-op openNewTab for IsolatedHTMLRenderer =====
	const openNewTab = useCallback(() => {
		// No-op in edit view context
	}, [])

	if (!activePost || !cards.length) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="red-edit-empty"
			>
				{t("detail.selfMedia.edit.noCards")}
			</div>
		)
	}

	return (
		<div className="flex h-full" data-testid="red-edit-view">
			<RednoteEditThumbnailSidebar
				post={activePost}
				activeCardIndex={activeCardIndex}
				attachmentList={attachmentList as SelfMediaAttachmentNode[]}
				postRefreshVersion={postRefreshVersion}
				cardRefreshVersions={cardRefreshVersions}
				onSelectCard={guardedSwitchCard}
				onRefreshCard={(targetIndex) => {
					runRefreshAfterGuard(() => {
						refreshCardByIndex(targetIndex)
					})
				}}
				onAddCardToCurrentChat={onAddCardToCurrentChat}
				onBeforeOpenVersionHistory={handleBeforeVersionHistoryOpen}
			/>

			{/* ===== Center: editor area ===== */}
			<div className="relative flex-1 overflow-hidden">
				{contentLoading ? (
					<div
						className="flex h-full items-center justify-center text-sm text-muted-foreground"
						data-testid="red-edit-loading"
					>
						{t("detail.selfMedia.common.loading")}
					</div>
				) : contentError ? (
					<div
						className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
						data-testid="red-edit-error"
					>
						{contentError}
					</div>
				) : cardContent ? (
					<div className="h-full w-full" data-testid="red-edit-renderer-shell">
						<IsolatedHTMLRenderer
							ref={rendererRef as React.RefObject<IsolatedHTMLRendererRef>}
							content={cardContent}
							sandboxType="iframe"
							isPptRender
							scaleContentDimensions={scaleContentDimensions}
							enableScalingHeightCalculation
							waitForSettledContentMetrics
							autoFitScalePaddingFactor={0.75}
							isEditMode={isEditMode}
							isSaving={isSaving}
							saveEditContent={saveEditContent}
							fileId={activeCard?.fileId}
							onSaveReady={handleSaveReady}
							filePathMapping={filePathMapping}
							openNewTab={openNewTab}
							htmlRelativeFolderPath={relativeFolderPath}
							selectedProject={selectedProject}
							attachmentList={attachmentList}
							isVisible
							toolbarEndRef={onHtmlToolbarEndRef}
							toolbarClassName={`absolute left-2 top-2 z-[10] p-2 ${selfMediaOverlayStyles.floatingPanel}`}
							className="h-full w-full"
						/>
						{htmlToolbarEndHost && hasUnsavedChanges && cardContent
							? createPortal(
									<FileEditButtons
										isEditMode
										isSaving={isSaving}
										showButtonText
										onSave={async () => {
											await executeSave()
										}}
										onCancel={handleCancelEdit}
									/>,
									htmlToolbarEndHost,
								)
							: null}
					</div>
				) : (
					<div
						className="flex h-full items-center justify-center text-sm text-muted-foreground"
						data-testid="red-edit-no-content"
					>
						{t("detail.selfMedia.common.noPosts")}
					</div>
				)}
			</div>

			<AlertDialog open={showUnsavedNavDialog}>
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="red-edit-unsaved-nav-dialog"
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
							data-testid="red-edit-unsaved-nav-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleDiscardBeforeNav}
							data-testid="red-edit-unsaved-nav-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleSaveBeforeNav}
							data-testid="red-edit-unsaved-nav-save-btn"
						>
							{t("detail.selfMedia.edit.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog open={showSaveRetryDialog}>
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="red-edit-save-retry-dialog"
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
							data-testid="red-edit-failed-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleRetryFailedSave}
							data-testid="red-edit-failed-retry-btn"
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
			<AlertDialog open={showVersionHistoryGuardDialog}>
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="red-edit-version-history-guard-dialog"
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
							onClick={handleVersionHistoryGuardCancel}
							data-testid="red-edit-version-history-guard-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleVersionHistoryGuardDiscard}
							data-testid="red-edit-version-history-guard-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleVersionHistoryGuardSave}
							data-testid="red-edit-version-history-guard-save-btn"
						>
							{t("detail.selfMedia.edit.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
})

export default RednoteEditView
