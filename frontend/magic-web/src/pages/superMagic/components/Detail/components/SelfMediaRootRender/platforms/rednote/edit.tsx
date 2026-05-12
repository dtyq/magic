import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
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
	const pendingActionRef = useRef<(() => void) | null>(null)
	const versionHistoryGateResolveRef = useRef<((allowed: boolean) => void) | null>(null)

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
				const urls = await getTemporaryDownloadUrl({ file_ids: [fileId] })
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

	const runPendingAction = useCallback(() => {
		pendingActionRef.current?.()
		pendingActionRef.current = null
	}, [])

	const clearPendingAction = useCallback(() => {
		pendingActionRef.current = null
	}, [])

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

	const runRefreshAfterGuard = useMemoizedFn((action: () => void) => {
		if (!isEditMode || !isDirtyRef.current) {
			action()
			return
		}

		pendingActionRef.current = action
		setShowRefreshConfirmDialog(true)
	})

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
			runPendingAction()
		}
	}, [executeSave, runPendingAction])

	const handleDiscardAfterFailedSave = useCallback(() => {
		setShowSaveRetryDialog(false)
		setDirtyState(false)
		runPendingAction()
	}, [runPendingAction, setDirtyState])

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
		runPendingAction()
	}, [runPendingAction, setDirtyState])

	const handleCancelNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		clearPendingAction()
	}, [clearPendingAction])

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

	const handleCancelEdit = useCallback(() => {
		setDirtyState(false)
		reloadActiveCardContent()
	}, [setDirtyState, reloadActiveCardContent])

	// ===== Version history guard (ask save before opening history dropdown) =====
	const handleBeforeVersionHistoryOpen = useMemoizedFn((): Promise<boolean> => {
		if (!isDirtyRef.current) return Promise.resolve(true)
		return new Promise<boolean>((resolve) => {
			versionHistoryGateResolveRef.current = resolve
			setShowVersionHistoryGuardDialog(true)
		})
	})

	const handleVersionHistoryGuardSave = useCallback(async () => {
		setShowVersionHistoryGuardDialog(false)
		const saved = await executeSave()
		versionHistoryGateResolveRef.current?.(saved)
		versionHistoryGateResolveRef.current = null
	}, [executeSave])

	const handleVersionHistoryGuardDiscard = useCallback(() => {
		setShowVersionHistoryGuardDialog(false)
		setDirtyState(false)
		reloadActiveCardContent()
		versionHistoryGateResolveRef.current?.(true)
		versionHistoryGateResolveRef.current = null
	}, [setDirtyState, reloadActiveCardContent])

	const handleVersionHistoryGuardCancel = useCallback(() => {
		setShowVersionHistoryGuardDialog(false)
		versionHistoryGateResolveRef.current?.(false)
		versionHistoryGateResolveRef.current = null
	}, [])

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
							relative_file_path={currentFile?.relative_file_path}
							selectedProject={selectedProject}
							attachmentList={attachmentList}
							isVisible
							toolbarEndRef={onHtmlToolbarEndRef}
							toolbarClassName="absolute left-1/2 top-2 z-[10] -translate-x-1/2 w-[98%] rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60"
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
				<AlertDialogContent data-testid="red-edit-unsaved-nav-dialog">
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
							data-testid="red-edit-unsaved-nav-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							onClick={handleDiscardBeforeNav}
							data-testid="red-edit-unsaved-nav-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							onClick={handleSaveBeforeNav}
							data-testid="red-edit-unsaved-nav-save-btn"
						>
							{t("detail.selfMedia.edit.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog open={showSaveRetryDialog}>
				<AlertDialogContent data-testid="red-edit-save-retry-dialog">
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
							data-testid="red-edit-failed-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
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
				<AlertDialogContent data-testid="red-edit-version-history-guard-dialog">
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
							onClick={handleVersionHistoryGuardCancel}
							data-testid="red-edit-version-history-guard-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							onClick={handleVersionHistoryGuardDiscard}
							data-testid="red-edit-version-history-guard-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
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
