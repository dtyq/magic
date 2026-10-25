import { memo, useCallback, useEffect, useRef, useState } from "react"
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
import { MonacoEditor } from "@/infrastructure/editors/monaco"
import type { editor } from "@/infrastructure/editors/monaco"
import { useTheme } from "@/models/config/hooks"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { flattenAttachments } from "../../../../contents/HTML/utils"
import type { FileItem } from "../../../../contents/HTML/utils/fetchInterceptor"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import type { PlatformComponentProps, SelfMediaPost, SelfMediaView } from "../../types"
import { selfMediaOverlayStyles } from "../../components/selfMediaOverlayStyles"
import { usePendingActionGuard } from "../../../../utils/usePendingActionGuard"

interface WechatCodeViewProps {
	post: SelfMediaPost
	attachmentList?: PlatformComponentProps["attachmentList"]
	saveEditContent?: PlatformComponentProps["saveEditContent"]
	onChangePost: (idx: number) => void
	onChangeView?: (view: SelfMediaView) => void
	onEditingStateChange?: (editing: boolean) => void
	onRequestViewChangeReady?: (handler: ((nextView: SelfMediaView) => void) | null) => void
	onRequestPostChangeReady?: (handler: ((nextPostIndex: number) => void) | null) => void
}

function WechatCodeView({
	post,
	attachmentList,
	saveEditContent,
	onChangePost,
	onChangeView,
	onEditingStateChange,
	onRequestViewChangeReady,
	onRequestPostChangeReady,
}: WechatCodeViewProps) {
	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const article = post.article
	const fileId = article?.fileId

	const [source, setSource] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const [showUnsavedNavDialog, setShowUnsavedNavDialog] = useState(false)
	const [showSaveRetryDialog, setShowSaveRetryDialog] = useState(false)

	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
	const isDirtyRef = useRef(false)

	const shouldBlockNavigation = useCallback(() => isDirtyRef.current, [])
	const handleNavigationBlocked = useCallback(() => {
		setShowUnsavedNavDialog(true)
	}, [])
	const navigationGuard = usePendingActionGuard({
		shouldBlock: shouldBlockNavigation,
		onBlocked: handleNavigationBlocked,
	})
	const {
		run: runNavigation,
		resolve: resolveNavigation,
		cancel: cancelNavigation,
	} = navigationGuard

	const { prefersColorScheme } = useTheme()
	const monacoTheme = prefersColorScheme === "dark" ? "vs-dark" : "vs-light"

	// Derive a stable version key from updated_at to re-fetch on content change.
	const fileUpdatedAt = fileId
		? flattenAttachments(attachmentList ?? []).find(
				(item): item is FileItem => item?.file_id === fileId,
			)?.updated_at
		: undefined

	const setDirtyState = useCallback((next: boolean) => {
		isDirtyRef.current = next
		setHasUnsavedChanges((prev) => (prev === next ? prev : next))
	}, [])

	useEffect(() => {
		onEditingStateChange?.(hasUnsavedChanges)
	}, [hasUnsavedChanges, onEditingStateChange])

	useEffect(() => {
		let cancelled = false
		if (!fileId) {
			setSource(null)
			setError(null)
			return
		}
		setLoading(true)
		setError(null)
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

				setSource(html)
				setDirtyState(false)
			} catch (err) {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "unknownError")
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [fileId, fileUpdatedAt, setDirtyState, fileApi])

	// Reset dirty state on post change
	useEffect(() => {
		setDirtyState(false)
	}, [fileId, setDirtyState])

	const executeSave = useMemoizedFn(async (): Promise<boolean> => {
		if (!fileId || !saveEditContent) return false
		const currentValue = editorRef.current?.getValue()
		if (currentValue == null) return false
		setSaving(true)
		try {
			await saveEditContent(currentValue, fileId)
			setDirtyState(false)
			return true
		} catch {
			return false
		} finally {
			setSaving(false)
		}
	})

	const runNavigationAfterSave = useMemoizedFn(async (action: () => void) => {
		return runNavigation(() => {
			setDirtyState(false)
			action()
		}, undefined)
	})

	const handleRequestViewChange = useMemoizedFn(async (nextView: SelfMediaView) => {
		if (!onChangeView || nextView === "code") {
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

	// Unsaved nav dialog handlers
	const handleSaveBeforeNav = useCallback(async () => {
		setShowUnsavedNavDialog(false)
		const saved = await executeSave()
		if (saved) {
			await resolveNavigation(true)
			return
		}
		setShowSaveRetryDialog(true)
	}, [executeSave, resolveNavigation])

	const handleDiscardBeforeNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		// Restore editor content to the last saved source before navigating away
		if (source != null && editorRef.current) {
			editorRef.current.setValue(source)
		}
		setDirtyState(false)
		void resolveNavigation(true)
	}, [resolveNavigation, setDirtyState, source])

	const handleCancelNav = useCallback(() => {
		setShowUnsavedNavDialog(false)
		cancelNavigation()
	}, [cancelNavigation])

	// Save-retry dialog handlers
	const handleRetryFailedSave = useCallback(async () => {
		const saved = await executeSave()
		if (saved) {
			setShowSaveRetryDialog(false)
			await resolveNavigation(true)
		}
	}, [executeSave, resolveNavigation])

	const handleDiscardAfterFailedSave = useCallback(() => {
		setShowSaveRetryDialog(false)
		if (source != null && editorRef.current) {
			editorRef.current.setValue(source)
		}
		setDirtyState(false)
		void resolveNavigation(true)
	}, [resolveNavigation, setDirtyState, source])

	const handleCancelEdit = useCallback(() => {
		if (!source) return
		editorRef.current?.setValue(source)
		setDirtyState(false)
	}, [source, setDirtyState])

	if (!fileId) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-code-empty"
			>
				{t("detail.selfMedia.common.noPosts")}
			</div>
		)
	}
	if (loading) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-code-loading"
			>
				{t("detail.selfMedia.common.loading")}
			</div>
		)
	}
	if (error) {
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
				data-testid="wechat-code-error"
			>
				{error}
			</div>
		)
	}
	if (source == null) return null

	return (
		<div className="relative h-full w-full" data-testid="wechat-code-view">
			{/* Floating save/cancel — only visible when there are unsaved changes */}
			{hasUnsavedChanges ? (
				<div
					className={`absolute right-4 top-1 z-50 flex items-center gap-1 px-2 py-1 ${selfMediaOverlayStyles.floatingPanel}`}
				>
					<FileEditButtons
						isEditMode
						isSaving={saving}
						showButtonText
						onSave={() => {
							void executeSave()
						}}
						onCancel={handleCancelEdit}
					/>
				</div>
			) : null}

			<MonacoEditor
				language="html"
				theme={monacoTheme}
				value={source}
				onChange={(value) => {
					setDirtyState((value ?? "") !== source)
				}}
				onMount={(ed) => {
					editorRef.current = ed
				}}
				options={{
					minimap: { enabled: false },
					wordWrap: "on",
					scrollBeyondLastLine: false,
					fontSize: 13,
					lineNumbers: "on",
					renderWhitespace: "selection",
				}}
				className="h-full w-full"
			/>

			{/* Unsaved changes dialog */}
			<AlertDialog open={showUnsavedNavDialog}>
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="wechat-code-unsaved-nav-dialog"
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
							data-testid="wechat-code-unsaved-nav-cancel-btn"
						>
							{t("detail.selfMedia.edit.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleDiscardBeforeNav}
							data-testid="wechat-code-unsaved-nav-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleSaveBeforeNav}
							data-testid="wechat-code-unsaved-nav-save-btn"
						>
							{t("detail.selfMedia.edit.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Save retry dialog */}
			<AlertDialog open={showSaveRetryDialog}>
				<AlertDialogContent
					className={selfMediaOverlayStyles.alertSurface}
					data-testid="wechat-code-save-retry-dialog"
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
							data-testid="wechat-code-failed-discard-btn"
						>
							{t("detail.selfMedia.edit.discard")}
						</AlertDialogAction>
						<AlertDialogAction
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleRetryFailedSave}
							data-testid="wechat-code-failed-retry-btn"
						>
							{t("detail.selfMedia.edit.retry")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

export default memo(WechatCodeView)
