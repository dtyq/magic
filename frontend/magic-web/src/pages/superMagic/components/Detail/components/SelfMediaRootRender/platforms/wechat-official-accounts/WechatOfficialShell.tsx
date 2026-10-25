import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import ExportPreviewDialog from "../../components/ExportPreviewDialog"
import type { ExportPreviewConfirmArgs } from "../../components/ExportPreviewDialog"
import SelfMediaShellHeader, { SelfMediaShellViewBar } from "../../components/SelfMediaShellHeader"
import { SELF_MEDIA_WORKSPACE_BACKGROUND_STYLE } from "../../components/SelfMediaWorkspaceBackground"
import { useExportProgressToast } from "../../hooks/useExportProgressToast"
import { useExportZip } from "../../hooks/useExportZip"
import { useShellFileHandlers } from "../../hooks/useShellFileHandlers"
import { SelfMediaStoreProvider, useOptionalSelfMediaStore, useSelfMediaStore } from "../../stores"
import type { PlatformComponentProps, SelfMediaView, SelfMediaWechatCoverType } from "../../types"
import WechatArticleView, { type WechatArticleViewRef } from "./article"
import WechatCodeView from "./code"
import { WechatCoverPhonePanel } from "./WechatCoverPhonePanel"
import WechatEditView from "./edit"
import { WechatOfficialContentGate } from "./WechatOfficialContentGate"
import { loadWechatArticleHtml } from "./wechatArticleHtml"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { buildWechatClipboardHtmlFromSource } from "./wechatClipboardHtml"
import { writeWechatHtmlToClipboard } from "./wechatClipboardWriter"
import { WECHAT_COVER_BASE_HEIGHT, WECHAT_COVER_BASE_WIDTH } from "./wechatCoverDimensions"

const TAB_ORDER: SelfMediaView[] = ["feed", "detail", "edit", "code"]

function WechatOfficialShell(props: PlatformComponentProps) {
	const store = useOptionalSelfMediaStore()
	if (store) return <WechatOfficialShellContent {...props} />

	return (
		<SelfMediaStoreProvider attachments={props.attachments ?? props.attachmentList}>
			<WechatOfficialShellContent {...props} />
		</SelfMediaStoreProvider>
	)
}

const WechatOfficialShellContent = observer(function WechatOfficialShellContent(
	props: PlatformComponentProps,
) {
	const { t } = useTranslation("super")
	const {
		platform,
		attachments,
		attachmentList,
		allowEdit,
		saveEditContent,
		selectedProject,
		onBackHome,
		onUpdatePostTitle,
		onRequestPrePublishAnalysis,
		onSharePost,
		shareLoading,
		onRequestWechatCoverGeneration,
	} = props
	const store = useSelfMediaStore()
	const { posts, loading, error, activePostIndex, view, rootLoading } = store

	const activePost = store.activePost ?? undefined
	const onChangeView = useCallback((nextView: SelfMediaView) => store.setView(nextView), [store])
	const onChangePost = useCallback(
		(nextIndex: number) => store.setActivePostIndex(nextIndex),
		[store],
	)
	const onEnsurePostLoaded = useCallback((idx: number) => store.ensurePostLoaded(idx), [store])

	const { handleAddFileToCurrentChat } = useShellFileHandlers({ attachmentList, activePost })

	const handleAddArticleToCurrentChat = useCallback(() => {
		handleAddFileToCurrentChat(activePost?.article?.fileId)
	}, [activePost, handleAddFileToCurrentChat])

	const handleGoToEdit = useCallback(() => {
		onChangeView("edit")
	}, [onChangeView])

	// Hide edit/code tabs when editing is not allowed (read-only / share mode)
	const visibleTabs = useMemo(
		() =>
			allowEdit === false ? TAB_ORDER.filter((v) => v !== "edit" && v !== "code") : TAB_ORDER,
		[allowEdit],
	)

	// Promote default "detail" to "feed" on first mount so users land on the cover list
	const promotedDefaultRef = useRef(false)
	useEffect(() => {
		if (promotedDefaultRef.current) return
		promotedDefaultRef.current = true
		if (view === "detail") {
			onChangeView("feed")
		}
	}, [view, onChangeView])

	// Normalize unsupported views (scroll) to the detail slot so switching from
	// another platform never leaves the shell with no visible tab.
	useEffect(() => {
		if (!TAB_ORDER.includes(view)) {
			onChangeView("detail")
		}
	}, [view, onChangeView])

	// Redirect away from edit/code views when editing is not allowed
	useEffect(() => {
		if (allowEdit === false && (view === "edit" || view === "code")) {
			onChangeView("detail")
		}
	}, [allowEdit, view, onChangeView])

	const [isArticleEditing, setIsArticleEditing] = useState(false)
	const editViewChangeHandlerRef = useRef<((nextView: SelfMediaView) => void) | null>(null)

	const [isCodeEditing, setIsCodeEditing] = useState(false)
	const codeViewChangeHandlerRef = useRef<((nextView: SelfMediaView) => void) | null>(null)

	const [mountedViews, setMountedViews] = useState(() => ({
		feed: view === "feed",
		detail: view === "detail",
		edit: view === "edit",
		code: view === "code",
	}))

	useEffect(() => {
		if (view === "scroll") return
		setMountedViews((prev) => (prev[view] ? prev : { ...prev, [view]: true }))
	}, [view])

	useEffect(() => {
		if (view !== "edit") setIsArticleEditing(false)
	}, [view])

	useEffect(() => {
		if (view !== "code") setIsCodeEditing(false)
	}, [view])

	const shouldRenderFeed = mountedViews.feed || view === "feed"
	const shouldRenderDetail = mountedViews.detail || view === "detail"
	const shouldRenderEdit = mountedViews.edit || view === "edit"
	const shouldRenderCode = mountedViews.code || view === "code"

	const articleViewRef = useRef<WechatArticleViewRef>(null)
	const [inspectorActive, setInspectorActive] = useState(false)
	const { progress, exportWechatCoverImage } = useExportZip()
	const fileApi = useFileApi()
	const [exportDialogOpen, setExportDialogOpen] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const [isCopyingWechatHtml, setIsCopyingWechatHtml] = useState(false)

	useExportProgressToast(progress, "wechat-official-shell-export")

	const handleStartInspector = useCallback(() => {
		articleViewRef.current?.startInspectorAppend()
	}, [])

	const handleStopInspector = useCallback(() => {
		articleViewRef.current?.stopInspector()
	}, [])

	const inspectorDisabled =
		allowEdit === false || view !== "detail" || rootLoading || !activePost?.article?.fileId

	// Auto-stop inspector when view changes
	useEffect(() => {
		if (inspectorActive) articleViewRef.current?.stopInspector()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view])

	const tabLabels = useMemo(
		() => ({
			feed: t("detail.selfMedia.platform.wechat-official-accounts.tabs.cover"),
			detail: t("detail.selfMedia.platform.wechat-official-accounts.tabs.article"),
			edit: t("detail.selfMedia.platform.wechat-official-accounts.tabs.edit"),
			code: t("detail.selfMedia.platform.wechat-official-accounts.tabs.code"),
		}),
		[t],
	)

	const handleEditingStateChange = useCallback((editing: boolean) => {
		setIsArticleEditing(editing)
	}, [])

	const handleCodeEditingStateChange = useCallback((editing: boolean) => {
		setIsCodeEditing(editing)
	}, [])

	const handleRequestViewChangeReady = useCallback(
		(handler: ((nextView: SelfMediaView) => void) | null) => {
			editViewChangeHandlerRef.current = handler
		},
		[],
	)

	const handleCodeRequestViewChangeReady = useCallback(
		(handler: ((nextView: SelfMediaView) => void) | null) => {
			codeViewChangeHandlerRef.current = handler
		},
		[],
	)

	const handleGuardedViewChange = useCallback(
		(nextView: SelfMediaView) => {
			if (view === "edit" && isArticleEditing && nextView !== "edit") {
				editViewChangeHandlerRef.current?.(nextView)
				return
			}
			if (view === "code" && isCodeEditing && nextView !== "code") {
				codeViewChangeHandlerRef.current?.(nextView)
				return
			}
			onChangeView(nextView)
		},
		[view, isArticleEditing, isCodeEditing, onChangeView],
	)

	const handleFeedSelectPost = useCallback(
		(idx: number) => {
			onChangePost(idx)
			onChangeView("detail")
		},
		[onChangePost, onChangeView],
	)

	const handleRefresh = useCallback(() => {
		void store.init({ preserveNavigation: true })
	}, [store])

	const handleOpenExportDialog = useCallback(() => {
		setExportDialogOpen(true)
	}, [])

	const handleConfirmExport = useCallback(
		async ({ postIndex, pixelRatio, format, exportType }: ExportPreviewConfirmArgs) => {
			if (exportType !== "wechatCoverImage") return
			setIsExporting(true)
			try {
				const target = await store.ensurePostLoaded(postIndex)
				if (!target) return
				await exportWechatCoverImage({
					post: target,
					fileName: target.meta.title || target.meta.feedTitle || target.meta.id,
					pixelRatio,
					format,
				})
				setExportDialogOpen(false)
			} finally {
				setIsExporting(false)
			}
		},
		[exportWechatCoverImage, store],
	)

	const handleCopyWechatHtml = useCallback(async () => {
		if (isCopyingWechatHtml) return
		setIsCopyingWechatHtml(true)
		try {
			const copiedFromPreview = articleViewRef.current?.copyArticleRichContent()
			if (!copiedFromPreview) {
				await writeWechatHtmlToClipboard(async () => {
					const html = await articleViewRef.current?.getArticleHtml()
					if (html) return html

					const target = await store.ensurePostLoaded(activePostIndex)
					const fileId = target?.article?.fileId
					if (!fileId) throw new Error("noArticleUrl")
					const result = await loadWechatArticleHtml({
						fileId,
						attachmentList,
						attachments,
						fileApi,
					})
					return buildWechatClipboardHtmlFromSource(result.content)
				})
			}
			magicToast.success(t("detail.selfMedia.export.wechat.copySuccess"))
		} catch {
			magicToast.error(t("detail.selfMedia.export.wechat.copyFailed"))
		} finally {
			setIsCopyingWechatHtml(false)
		}
	}, [activePostIndex, attachmentList, attachments, fileApi, isCopyingWechatHtml, store, t])

	const handleGenerateWechatCovers = useCallback(
		async ({
			postIndex,
			coverTypes,
		}: {
			postIndex: number
			coverTypes: SelfMediaWechatCoverType[]
		}) => {
			if (!onRequestWechatCoverGeneration) return false
			const started = await onRequestWechatCoverGeneration({
				index: postIndex,
				coverTypes,
			})
			if (started) setExportDialogOpen(false)
			return started
		},
		[onRequestWechatCoverGeneration],
	)

	const handleSaveTitle = useCallback(
		async (nextTitle: string) => {
			const entry = store.activePostEntry
			if (!entry || !onUpdatePostTitle) return false
			const saved = await onUpdatePostTitle(
				{ platform, index: activePostIndex, entry },
				nextTitle,
			)
			if (saved === false) return false
			store.updatePostTitle(activePostIndex, nextTitle)
			return true
		},
		[activePostIndex, onUpdatePostTitle, platform, store],
	)

	return (
		<div
			className="relative flex h-full w-full flex-col"
			style={SELF_MEDIA_WORKSPACE_BACKGROUND_STYLE}
			data-testid="wechat-official-shell"
		>
			<SelfMediaShellHeader
				platform={platform}
				posts={posts}
				activePostIndex={activePostIndex}
				view={view}
				tabLabels={tabLabels}
				visibleTabs={visibleTabs}
				onChangeView={handleGuardedViewChange}
				onRefresh={handleRefresh}
				onBackHome={onBackHome}
				refreshLabel={t("detail.selfMedia.refreshAllData")}
				refreshDisabled={rootLoading}
				refreshTestId="wechat-shell-refresh-post-button"
				onShare={onSharePost}
				shareLoading={shareLoading}
				onOpenExport={handleOpenExportDialog}
				exportLabel={t("detail.selfMedia.export.action")}
				exportDisabled={isExporting || posts.length === 0}
				onStartInspector={handleStartInspector}
				onStopInspector={handleStopInspector}
				inspectorActive={inspectorActive}
				inspectorDisabled={inspectorDisabled}
				onSaveTitle={allowEdit === false ? undefined : handleSaveTitle}
			/>
			<ExportPreviewDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				posts={posts}
				initialPostIndex={activePostIndex}
				attachmentList={attachmentList}
				onSyncActivePost={onChangePost}
				onConfirm={handleConfirmExport}
				isExporting={isExporting}
				exportMode="wechatOfficial"
				onCopyWechatHtml={handleCopyWechatHtml}
				isCopyingWechatHtml={isCopyingWechatHtml}
				onGenerateWechatCovers={allowEdit ? handleGenerateWechatCovers : undefined}
				exportSizeHintCss={{
					width: WECHAT_COVER_BASE_WIDTH,
					height: WECHAT_COVER_BASE_HEIGHT,
				}}
			/>

			<div className="relative min-h-0 flex-1 overflow-hidden">
				{shouldRenderFeed ? (
					<WechatCoverPhonePanel
						visible={view === "feed"}
						loading={loading}
						error={error}
						posts={posts}
						activePostIndex={activePostIndex}
						attachmentList={attachmentList}
						onSelectPost={handleFeedSelectPost}
						onEnsurePostLoaded={onEnsurePostLoaded}
					/>
				) : null}

				{shouldRenderDetail ? (
					<div
						className={
							view === "detail" ? "absolute inset-0 block" : "absolute inset-0 hidden"
						}
						aria-hidden={view !== "detail"}
					>
						<WechatOfficialContentGate
							loading={loading}
							error={error}
							hasPost={Boolean(activePost)}
						>
							{activePost ? (
								<WechatArticleView
									ref={articleViewRef}
									post={activePost}
									attachments={attachments}
									attachmentList={attachmentList}
									selectedProject={selectedProject}
									onAddToCurrentChat={handleAddArticleToCurrentChat}
									onGoToEdit={handleGoToEdit}
									onRefresh={handleRefresh}
									allowEdit={allowEdit}
									onInspectorActiveChange={setInspectorActive}
								/>
							) : null}
						</WechatOfficialContentGate>
					</div>
				) : null}

				{shouldRenderEdit ? (
					<div
						className={
							view === "edit" ? "absolute inset-0 block" : "absolute inset-0 hidden"
						}
						aria-hidden={view !== "edit"}
					>
						<WechatOfficialContentGate
							loading={loading}
							error={error}
							hasPost={Boolean(activePost)}
						>
							{activePost ? (
								<WechatEditView
									post={activePost}
									attachmentList={attachmentList}
									saveEditContent={saveEditContent}
									selectedProject={selectedProject}
									onChangePost={onChangePost}
									onChangeView={onChangeView}
									onEditingStateChange={handleEditingStateChange}
									onRequestViewChangeReady={handleRequestViewChangeReady}
								/>
							) : null}
						</WechatOfficialContentGate>
					</div>
				) : null}

				{shouldRenderCode ? (
					<div
						className={
							view === "code" ? "absolute inset-0 block" : "absolute inset-0 hidden"
						}
						aria-hidden={view !== "code"}
					>
						<WechatOfficialContentGate
							loading={loading}
							error={error}
							hasPost={Boolean(activePost)}
						>
							{activePost ? (
								<WechatCodeView
									post={activePost}
									attachmentList={attachmentList}
									saveEditContent={saveEditContent}
									onChangePost={onChangePost}
									onChangeView={onChangeView}
									onEditingStateChange={handleCodeEditingStateChange}
									onRequestViewChangeReady={handleCodeRequestViewChangeReady}
								/>
							) : null}
						</WechatOfficialContentGate>
					</div>
				) : null}
			</div>
			<SelfMediaShellViewBar
				view={view}
				tabLabels={tabLabels}
				visibleTabs={visibleTabs}
				onChangeView={handleGuardedViewChange}
				onRequestPrePublishAnalysis={allowEdit ? onRequestPrePublishAnalysis : undefined}
			/>
		</div>
	)
})

export default WechatOfficialShell
