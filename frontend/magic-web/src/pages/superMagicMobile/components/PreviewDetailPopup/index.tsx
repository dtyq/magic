import Render from "@/pages/superMagic/components/Detail/Render"
import { DetailType } from "@/pages/superMagic/components/Detail/types"
import { correctDetailType } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview"
import { Toast } from "antd-mobile"
import type { Ref } from "react"
import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useDetailActions } from "@/pages/superMagic/components/Detail/hooks/useDetailActions"
import { isEmpty } from "lodash-es"
import { useLocation } from "react-router"
import { copyFileContent } from "@/pages/superMagic/utils/share"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { useMemoizedFn } from "ahooks"
import { X } from "lucide-react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { retainMobilePresentationLayout } from "@/stores/layout/mobilePresentationLayout"
import MagicModal from "@/components/base/MagicModal"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import { OverlayZIndexProvider } from "@/utils/overlayZIndex"
import { cn } from "@/utils/cn"
import { getPreviewDetailDisplayName } from "./headerMeta"
import {
	MOBILE_PREVIEW_BODY_CLASSNAME,
	MOBILE_PREVIEW_SHEET_CLASSNAME,
	PREVIEW_MOBILE_BOTTOM_GAP_CLASSNAME,
	PREVIEW_MOBILE_FULLSCREEN_CLASSNAME,
	PREVIEW_MODAL_BODY_CLASSNAME,
	PREVIEW_MODAL_BODY_FULLSCREEN_CLASSNAME,
	PREVIEW_MODAL_BODY_WRAPPER_CLASSNAME,
	PREVIEW_MODAL_CLASSNAME,
	PREVIEW_MODAL_CONTENT_FULLSCREEN_CLASSNAME,
	PREVIEW_MODAL_FULLSCREEN_CLASSNAME,
	PREVIEW_SHARE_CONTAINER_CLASSNAME,
	PREVIEW_SHARE_IMMERSIVE_CLASSNAME,
} from "./layoutClassNames"
import type { PreviewDetail, PreviewDetailPopupProps, PreviewDetailPopupRef } from "./types"

export type { PreviewDetail, PreviewDetailPopupRef } from "./types"

const OFFICE_DETAIL_TYPES: DetailType[] = [
	DetailType.Docx,
	DetailType.Doc,
	DetailType.Excel,
	DetailType.PowerPoint,
]

function PreviewDetailPopup(props: PreviewDetailPopupProps, ref: Ref<PreviewDetailPopupRef>) {
	const {
		selectedTopic,
		isFileShare,
		enableImmersiveShareChrome,
		isImmersiveFullscreen,
		selectedProject,
		onOpenNewPopup,
		projectId = "",
		allowDownload,
		hideHeader: hideHeaderProp,
		showFileHeader,
		forceFullscreenMode,
		documentFlowFullscreen = false,
		allowEdit,
		onPreviewFileChange,
		onPreviewFullscreenChange,
		zIndex,
		inline = false,
	} = props

	const isMobile = useIsMobile()
	const { pathname, search } = useLocation()

	// 检查 URL 中是否有 hideHeader 参数。显式 props 优先，用于 pure_mode 等配置驱动场景。
	const hideHeader = useMemo(() => {
		if (hideHeaderProp !== undefined) return hideHeaderProp
		const urlSearchParams = new URLSearchParams(search)
		return urlSearchParams.get("hideHeader") === "true"
	}, [hideHeaderProp, search])

	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const [previewDetail, setPreviewDetail] = useState<PreviewDetail>()
	const [visible, setVisible] = useState(false)
	const shouldOwnOverlayLayer = visible && !isFileShare && !inline
	const { overlayZIndex, releaseOverlayZIndex } = useOverlayZIndex({
		open: shouldOwnOverlayLayer,
		zIndex,
	})
	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const [attachmentList, setAttachmentList] = useState<AttachmentItem[]>([])
	const [userSelectDetail, setUserDetail] = useState<PreviewDetail>()
	// New state for ActionButtons functionality
	const [viewMode, setViewMode] = useState<"code" | "desktop" | "phone">("desktop")
	const [favoriteFiles, setFavoriteFiles] = useState<Set<string>>(new Set())
	const releaseMobileLayoutRef = useRef<(() => void) | null>(null)
	const releaseMobileLayout = useMemoizedFn(() => {
		releaseMobileLayoutRef.current?.()
		releaseMobileLayoutRef.current = null
	})
	useEffect(() => () => releaseMobileLayout(), [releaseMobileLayout])

	const open = useCallback(
		(
			options: PreviewDetail,
			attachmentTree: AttachmentItem[],
			attachmentList: AttachmentItem[],
		) => {
			// Exiting PPT fullscreen may leave the viewport in landscape. Keep the route and
			// sheet mounted until this preview closes, so its file, slide and draft state survive.
			// Inline previews live inside the page and never close, so they hold no layout lock.
			if (isMobile && !isFileShare && !inline) {
				releaseMobileLayoutRef.current ??= retainMobilePresentationLayout()
			}
			setPreviewDetail(options)
			setAttachments(attachmentTree || [])
			setAttachmentList(attachmentList || [])
			setUserDetail(options)
			setVisible(true)
		},
		[isMobile, isFileShare, inline],
	)

	/** Keeps an open preview aligned with project attachment data loaded after first render. */
	const updateAttachments = useCallback(
		(attachmentTree: AttachmentItem[], nextAttachmentList: AttachmentItem[]) => {
			setAttachments(attachmentTree || [])
			setAttachmentList(nextAttachmentList || [])
		},
		[],
	)

	const onlyUpdateDetail = useCallback(
		(
			options: PreviewDetail,
			attachmentTree: AttachmentItem[],
			attachmentList: AttachmentItem[],
		) => {
			if (options.isFromNode && previewDetail?.isFromNode) {
				setPreviewDetail(options)
				setAttachments(attachmentTree || [])
				setAttachmentList(attachmentList || [])
				setUserDetail(options)
			}
		},
		[previewDetail?.isFromNode],
	)

	// Handle view mode change between code, desktop and phone
	const handleViewModeChange = useCallback((mode: "code" | "desktop" | "phone") => {
		setViewMode(mode)
	}, [])

	useEffect(() => {
		if (previewDetail?.name === "read_file" || previewDetail?.name === "read_files") {
			setViewMode("code")
		}
	}, [previewDetail?.name])

	// Handle copy functionality for files
	const handleCopy = useCallback(
		async (fileContent?: string, fileVersion?: number, fileId?: string) => {
			copyFileContent(
				attachmentList,
				t,
				fileId || previewDetail?.data?.file_id || "",
				fileContent,
				fileVersion,
				fileApi,
			)
		},
		[attachmentList, fileApi, t, previewDetail?.data?.file_id],
	)

	// Handle share functionality for files
	const handleShare = useCallback(() => {
		// TODO: Implement actual share functionality with your share modal/system
		console.log("Sharing file:", previewDetail?.data?.file_name)
		Toast.show(t("common.shareFeatureDevelopment"))
	}, [previewDetail?.data?.file_name, t])

	// Handle favorite/unfavorite functionality
	const handleFavorite = useCallback(() => {
		if (!previewDetail?.currentFileId) return

		setFavoriteFiles((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(previewDetail.currentFileId)) {
				newSet.delete(previewDetail.currentFileId)
				Toast.show(t("common.removeFavoriteSuccess"))
			} else {
				newSet.add(previewDetail.currentFileId)
				Toast.show(t("common.addFavoriteSuccess"))
			}
			return newSet
		})
	}, [previewDetail?.currentFileId, t])

	useImperativeHandle(ref, () => {
		return {
			open,
			onlyUpdateDetail,
			updateAttachments,
		}
	})

	const { setUserSelectDetail, onClose } = props

	const {
		isFullscreen,
		isFromNode,
		handlePrevious,
		handleNext,
		handleFullscreen,
		handleDownload,
		allFiles,
		currentIndex,
		effectiveAttachments,
		setIsFullscreen,
	} = useDetailActions({
		disPlayDetail: previewDetail,
		setUserSelectDetail,
		attachments,
	})
	const effectiveIsFullscreen = Boolean(forceFullscreenMode) || isFullscreen

	/** Close preview and clear local fullscreen state before the next open. */
	const handleClose = useCallback(() => {
		setIsFullscreen(false)
		onClose?.()
		setVisible(false)
		releaseMobileLayout()
	}, [onClose, releaseMobileLayout, setIsFullscreen])

	/** Release after exit animation so the closing layer keeps its stack slot. */
	const handleOverlayExited = useCallback(() => {
		releaseOverlayZIndex()
	}, [releaseOverlayZIndex])

	const isShareRoute = useMemo(() => {
		// 检查是否在分享场景，如果是分享场景则不显示下载全部文件按钮
		return pathname.includes("/share/")
	}, [pathname])

	const openFileTab = useMemoizedFn((file: AttachmentItem) => {
		const fileType = getFileType(file.file_extension || "")
		const newDetail = {
			type: fileType,
			data: {
				file_id: file.file_id || "",
				file_name: file.file_name || file.filename || "",
				file_extension: file.file_extension || "",
				file_url: file.file_url || "",
				file_size: file.file_size || 0,
			},
			currentFileId: file.file_id || "",
		} as PreviewDetail

		// 如果有 onOpenNewPopup 回调，使用它打开新弹层；否则使用 setUserSelectDetail（向后兼容）
		if (onOpenNewPopup) {
			onOpenNewPopup(newDetail, attachments, attachmentList)
		} else {
			setUserSelectDetail?.(newDetail)
		}
	})

	useEffect(() => {
		onPreviewFileChange?.(previewDetail?.currentFileId || null)
	}, [onPreviewFileChange, previewDetail?.currentFileId])

	useEffect(() => {
		onPreviewFullscreenChange?.(effectiveIsFullscreen)
	}, [effectiveIsFullscreen, onPreviewFullscreenChange])

	const RenderComponent = useMemo(() => {
		// 修正 detail 类型（如果 metadata.type 是 design 但 type 是 notSupport，需要修正）
		const correctedPreviewDetail = correctDetailType(previewDetail, {
			attachmentList,
		})
		if (!correctedPreviewDetail?.type) return null

		// 设计太垃，兼容数据格式
		const meta = attachmentList.find(
			(item) => item?.file_id === correctedPreviewDetail?.currentFileId,
		)

		const previewFilePath = meta?.relative_file_path || ""
		return (
			<Render
				key={previewDetail?.currentFileId}
				type={correctedPreviewDetail?.type}
				data={correctedPreviewDetail?.data}
				attachments={effectiveAttachments}
				setUserSelectDetail={setUserSelectDetail}
				currentIndex={currentIndex}
				onPrevious={handlePrevious}
				onNext={handleNext}
				onFullscreen={handleFullscreen}
				onDownload={handleDownload}
				totalFiles={allFiles.length}
				hasUserSelectDetail={!isEmpty(previewDetail)}
				isFromNode={isFromNode}
				onClose={onClose}
				userSelectDetail={userSelectDetail}
				isFullscreen={effectiveIsFullscreen}
				documentFlowFullscreen={documentFlowFullscreen}
				attachmentList={attachmentList}
				display_config={meta?.display_config}
				// New props for ActionButtons functionality
				viewMode={viewMode}
				onViewModeChange={handleViewModeChange}
				onCopy={(fileVersion?: number, fileId?: string) =>
					handleCopy(
						(previewDetail?.data as { content?: string })?.content,
						fileVersion,
						fileId,
					)
				}
				onShare={handleShare}
				onFavorite={handleFavorite}
				fileContent={(previewDetail?.data as { content?: string })?.content || ""}
				isFavorited={favoriteFiles.has(previewDetail?.currentFileId || "")}
				baseShareUrl={`${window.location.origin}/share`}
				currentFile={{
					id: previewDetail?.currentFileId || "",
					name: (previewDetail?.data as { file_name?: string })?.file_name || "",
					type:
						(previewDetail?.data as { file_extension?: string })?.file_extension || "",
					url: (previewDetail?.data as { file_url?: string })?.file_url || "",
					relativeFilePath: previewFilePath,
				}}
				topicId={previewDetail?.topicId || selectedTopic?.id || ""}
				openFileTab={openFileTab}
				activeFileId={previewDetail?.currentFileId || ""}
				selectedProject={selectedProject}
				projectId={selectedProject?.id || projectId}
				isPlaybackMode={!!previewDetail?.isFromNode || false}
				allowDownload={allowDownload}
				allowEdit={allowEdit}
				showFileHeader={showFileHeader ?? !isImmersiveFullscreen}
				// Mobile sheet: MagicPopup shows title; toolbar-only header avoids duplicate chrome.
				headerRenderMode={isMobile ? "actions" : "full"}
				// Mobile preview hides version footer; desktop keeps version selector when allowed.
				showFooter={!isMobile && !effectiveIsFullscreen && !isShareRoute}
				className={
					documentFlowFullscreen
						? "min-h-dvh w-full overflow-visible"
						: effectiveIsFullscreen
							? "h-full min-h-0 w-full flex-1"
							: isMobile
								? "min-h-0 flex-1"
								: undefined
				}
			/>
		)
	}, [
		allFiles.length,
		allowDownload,
		allowEdit,
		attachmentList,
		currentIndex,
		effectiveAttachments,
		favoriteFiles,
		handleCopy,
		handleDownload,
		handleFavorite,
		handleFullscreen,
		handleNext,
		handlePrevious,
		handleShare,
		handleViewModeChange,
		effectiveIsFullscreen,
		isFromNode,
		isImmersiveFullscreen,
		isMobile,
		isShareRoute,
		onClose,
		openFileTab,
		previewDetail,
		projectId,
		selectedProject,
		selectedTopic?.id,
		setUserSelectDetail,
		showFileHeader,
		userSelectDetail,
		viewMode,
		documentFlowFullscreen,
	])

	const displayFileName = useMemo(() => {
		// 修正 detail 类型（如果 metadata.type 是 design 但 type 是 notSupport，需要修正）
		const correctedPreviewDetail = correctDetailType(previewDetail, {
			attachmentList,
		})
		return getPreviewDetailDisplayName(correctedPreviewDetail, t)
	}, [attachmentList, previewDetail, t])

	const isOfficePreview = useMemo(() => {
		const correctedPreviewDetail = correctDetailType(previewDetail, {
			attachmentList,
		})
		return correctedPreviewDetail
			? OFFICE_DETAIL_TYPES.includes(correctedPreviewDetail.type as DetailType)
			: false
	}, [attachmentList, previewDetail])

	if (inline) {
		return (
			<div
				className="flex h-full min-h-0 w-full flex-col bg-background"
				data-testid="inline-preview-detail-root"
			>
				{previewDetail ? RenderComponent : null}
			</div>
		)
	}

	if (isFileShare) {
		return (
			<div
				className={cn(
					PREVIEW_SHARE_CONTAINER_CLASSNAME,
					hideHeader ? "h-full" : "mt-[52px] h-[calc(100%_-_52px)]",
					{
						[PREVIEW_SHARE_IMMERSIVE_CLASSNAME]:
							enableImmersiveShareChrome && isImmersiveFullscreen,
					},
				)}
				style={
					documentFlowFullscreen
						? { height: "auto", minHeight: "100dvh", marginTop: 0, overflow: "visible" }
						: undefined
				}
				data-testid="share-preview-detail-popup-root"
			>
				{RenderComponent}
			</div>
		)
	}

	if (isMobile) {
		return (
			<MagicPopup
				visible={visible}
				onClose={handleClose}
				position="bottom"
				title={displayFileName}
				zIndex={overlayZIndex}
				zIndexManaged={false}
				onAnimationEnd={(isOpen) => {
					if (!isOpen) handleOverlayExited()
				}}
				headerVariant={hideHeader ? undefined : "actionHeader"}
				headerTitle={displayFileName}
				headerLeadingAction={
					hideHeader
						? undefined
						: {
								icon: <X className="h-[22px] w-[22px]" />,
								ariaLabel: t("common.close"),
								onClick: handleClose,
								testId: "file-preview-popup-close-button",
							}
				}
				hideDefaultHandle={hideHeader || effectiveIsFullscreen}
				className={cn(
					MOBILE_PREVIEW_SHEET_CLASSNAME,
					effectiveIsFullscreen && PREVIEW_MOBILE_FULLSCREEN_CLASSNAME,
				)}
				bodyClassName={cn(
					MOBILE_PREVIEW_BODY_CLASSNAME,
					isShareRoute && previewDetail?.isFromNode
						? PREVIEW_MOBILE_BOTTOM_GAP_CLASSNAME
						: undefined,
				)}
				maskClosable
				data-testid="file-preview-detail-popup-root"
			>
				<OverlayZIndexProvider value={overlayZIndex}>
					<div className="flex min-h-0 flex-1 flex-col bg-background">
						{!!previewDetail && visible && <>{RenderComponent}</>}
					</div>
				</OverlayZIndexProvider>
			</MagicPopup>
		)
	}

	return (
		<MagicModal
			open={visible}
			maskClosable
			mask
			onCancel={() => {
				if (effectiveIsFullscreen && !forceFullscreenMode) {
					setIsFullscreen(false)
					return
				}
				handleClose()
			}}
			destroyOnClose={isOfficePreview}
			closable={!effectiveIsFullscreen}
			footer={null}
			title={effectiveIsFullscreen ? undefined : t("microAppPage.previewDialog.title")}
			classNames={{
				header: effectiveIsFullscreen ? "hidden" : undefined,
				content: effectiveIsFullscreen
					? PREVIEW_MODAL_CONTENT_FULLSCREEN_CLASSNAME
					: undefined,
				body: cn(
					PREVIEW_MODAL_BODY_CLASSNAME,
					effectiveIsFullscreen && PREVIEW_MODAL_BODY_FULLSCREEN_CLASSNAME,
				),
			}}
			className={cn(
				PREVIEW_MODAL_CLASSNAME,
				effectiveIsFullscreen && PREVIEW_MODAL_FULLSCREEN_CLASSNAME,
			)}
			centered={!effectiveIsFullscreen}
			zIndex={overlayZIndex}
			afterClose={handleOverlayExited}
		>
			<OverlayZIndexProvider value={overlayZIndex}>
				<div className={PREVIEW_MODAL_BODY_WRAPPER_CLASSNAME}>
					{!!previewDetail && visible && <>{RenderComponent}</>}
				</div>
			</OverlayZIndexProvider>
		</MagicModal>
	)
}

export default memo(forwardRef(PreviewDetailPopup))
