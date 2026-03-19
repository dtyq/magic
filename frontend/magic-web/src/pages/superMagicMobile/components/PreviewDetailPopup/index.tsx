import Render from "@/pages/superMagic/components/Detail/Render"
import { DetailType, type DetailData } from "@/pages/superMagic/components/Detail/types"
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
	useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "../CommonPopup/styles"
import { useDetailActions } from "@/pages/superMagic/components/Detail/hooks/useDetailActions"
import { isEmpty } from "lodash-es"
import CommonPopup from "../CommonPopup"
import { useLocation } from "react-router"
import { copyFileContent } from "@/pages/superMagic/utils/share"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { useMemoizedFn } from "ahooks"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { Flex } from "antd"
import ToolIcon from "@/pages/superMagic/components/MessageList/components/Tool/components/ToolIcon"
import { getAttachmentExtension } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import IconTerminal from "@/pages/superMagic/assets/svg/terminal.svg"
import PDFIcon from "@/pages/superMagic/assets/file_icon/pdf.svg"
import CommonFileIcon from "@/pages/superMagic/assets/svg/file.svg"
import DesignIcon from "@/components/base/MagicFileIcon/assets/design.svg"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { Topic, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicModal from "@/components/base/MagicModal"

export interface PreviewDetail<T extends keyof DetailData = keyof DetailData> {
	type: T
	data: DetailData[T]
	currentFileId: string
	isFromNode?: boolean
	// 后面需要跟着项目走
	topicId?: string
	name?: string
}

export interface PreviewDetailPopupRef {
	open: (
		options: PreviewDetail,
		attachmentTree: AttachmentItem[],
		attachmentList: AttachmentItem[],
	) => void
}

interface PreviewDetailPopupProps {
	setUserSelectDetail: (detail: PreviewDetail | null) => void
	onClose?: () => void
	selectedTopic?: Topic | null
	isFileShare?: boolean
	selectedProject?: ProjectListItem | null
	onOpenNewPopup?: (
		detail: PreviewDetail,
		attachmentTree: AttachmentItem[],
		attachmentList: AttachmentItem[],
	) => void
	projectId?: string
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
}

function PreviewDetailPopup(props: PreviewDetailPopupProps, ref: Ref<PreviewDetailPopupRef>) {
	const {
		selectedTopic,
		isFileShare,
		selectedProject,
		onOpenNewPopup,
		projectId = "",
		allowDownload,
	} = props

	const isMobile = useIsMobile()
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const [previewDetail, setPreviewDetail] = useState<PreviewDetail>()
	const [visible, setVisible] = useState(false)
	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const [attachmentList, setAttachmentList] = useState<AttachmentItem[]>([])
	const [userSelectDetail, setUserDetail] = useState<PreviewDetail>()
	// New state for ActionButtons functionality
	const [viewMode, setViewMode] = useState<"code" | "desktop" | "phone">("desktop")
	const [favoriteFiles, setFavoriteFiles] = useState<Set<string>>(new Set())
	const { pathname } = useLocation()

	const open = useCallback(
		(
			options: PreviewDetail,
			attachmentTree: AttachmentItem[],
			attachmentList: AttachmentItem[],
		) => {
			setPreviewDetail(options)
			setAttachments(attachmentTree || [])
			setAttachmentList(attachmentList || [])
			setUserDetail(options)
			setVisible(true)
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
	}, [previewDetail])

	// Handle copy functionality for files
	const handleCopy = useCallback(
		async (fileContent?: string, fileVersion?: number, fileId?: string) => {
			copyFileContent(
				attachmentList,
				t,
				fileId || previewDetail?.data?.file_id || "",
				fileContent,
				fileVersion,
			)
		},
		[attachmentList, t, previewDetail?.data?.file_id],
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
		}
	})

	const { setUserSelectDetail, onClose } = props

	const {
		isFromNode,
		handlePrevious,
		handleNext,
		handleFullscreen,
		handleDownload,
		allFiles,
		currentIndex,
		effectiveAttachments,
	} = useDetailActions({
		disPlayDetail: previewDetail,
		setUserSelectDetail,
		attachments,
	})

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

	const RenderComponent = useMemo(() => {
		// 设计太垃，兼容数据格式
		const meta = attachmentList.find((item) => item?.file_id === previewDetail?.currentFileId)
		// 修正 detail 类型（如果 metadata.type 是 design 但 type 是 notSupport，需要修正）
		const correctedPreviewDetail = correctDetailType(previewDetail)
		return (
			<Render
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
				attachmentList={attachmentList}
				metadata={meta?.metadata}
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
				}}
				topicId={previewDetail?.topicId || selectedTopic?.id || ""}
				openFileTab={openFileTab}
				activeFileId={previewDetail?.currentFileId || ""}
				selectedProject={selectedProject}
				projectId={selectedProject?.id || projectId}
				isPlaybackMode={!!previewDetail?.isFromNode || false}
				allowDownload={allowDownload}
			/>
		)
	}, [
		allFiles.length,
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
		isFromNode,
		onClose,
		openFileTab,
		previewDetail,
		projectId,
		selectedProject,
		selectedTopic?.id,
		setUserSelectDetail,
		userSelectDetail,
		viewMode,
	])

	const FileIcon = useMemo(() => {
		// 修正 detail 类型（如果 metadata.type 是 design 但 type 是 notSupport，需要修正）
		const correctedPreviewDetail = correctDetailType(previewDetail)
		const data = correctedPreviewDetail?.data as {
			file_extension?: string
			metadata?: Record<string, unknown>
		}
		const file_extension = data?.file_extension || ""
		// Type assertion for switch - DetailType includes types not in DetailData
		const currentType = correctedPreviewDetail?.type as DetailType
		switch (currentType) {
			case DetailType.Md:
				return <MagicFileIcon size={20} type="md" />
			case DetailType.Browser:
				return <ToolIcon type="use_browser" />
			case DetailType.Html:
				return (
					<MagicFileIcon
						size={20}
						type={getAttachmentExtension(data?.metadata) || "html"}
					/>
				)
			case DetailType.Search:
				return <ToolIcon type="web_search" />
			case DetailType.Terminal:
				return <img src={IconTerminal} alt="terminal" />
			case DetailType.Text:
				return <MagicFileIcon size={20} type={file_extension} />
			case DetailType.Pdf:
				return <img src={PDFIcon} alt="" />
			case DetailType.Code:
				return file_extension ? (
					<MagicFileIcon type={file_extension} size={20} />
				) : (
					<img src={CommonFileIcon} width={20} height={20} alt="" />
				)
			case DetailType.Excel:
				return <MagicFileIcon type={file_extension?.toLowerCase()} size={18} />
			case DetailType.Image:
				return <MagicFileIcon size={20} type={file_extension} />
			case DetailType.FileTree:
				return <ToolIcon type="list_dir" />
			case DetailType.Design:
				return <img src={DesignIcon} width={20} height={20} alt="design" />
			case DetailType.Deleted:
				return <MagicFileIcon type={file_extension} size={20} />
			case DetailType.NotSupport:
			default:
				return <MagicFileIcon size={20} type={file_extension} />
		}
	}, [previewDetail])

	const displayFileName = useMemo(() => {
		// 修正 detail 类型（如果 metadata.type 是 design 但 type 是 notSupport，需要修正）
		const correctedPreviewDetail = correctDetailType(previewDetail)
		if (!correctedPreviewDetail?.data) return t("ui.preview")

		const currentType = correctedPreviewDetail.type as DetailType
		const data = correctedPreviewDetail.data as {
			name?: string
			file_name?: string
			title?: string
			metadata?: { name?: string }
		}

		// Design 类型优先使用 data.name
		if (currentType === DetailType.Design) {
			return data.name || data.metadata?.name || data.file_name || t("ui.preview")
		}

		// 其他类型按优先级获取
		return data.metadata?.name || data.file_name || data.title || t("ui.preview")
	}, [previewDetail, t])

	if (isFileShare) {
		return <div className={styles.renderContainer}>{RenderComponent}</div>
	}

	if (isMobile) {
		return (
			<CommonPopup
				title={
					<Flex align="center" gap={4}>
						{FileIcon}
						<div className={styles.fileName}>{displayFileName}</div>
					</Flex>
				}
				popupProps={{
					position: "bottom",
					visible,
					onClose: () => {
						onClose?.()
						setVisible(false)
					},
					bodyClassName:
						isShareRoute && previewDetail?.isFromNode
							? styles.bottomGap
							: styles.popupBody,
					// 从节点打开的detail，层级要比底部1020低，从话题文件打开的，层级要比底部的高
					// style: { zIndex: previewDetail?.isFromNode ? 1019 : 1023 },
					onMaskClick: () => {
						setVisible(false)
					},
					className: "h-[90%]",
				}}
			>
				<div className={cx(styles.body)}>
					{!!previewDetail && visible && <>{RenderComponent}</>}
				</div>
			</CommonPopup>
		)
	}

	return (
		<MagicModal
			open={visible}
			maskClosable
			mask
			onCancel={() => {
				setVisible(false)
			}}
			closable
			footer={null}
			title="文件预览"
			classNames={{
				body: styles.modalBody,
			}}
			className={styles.modal}
			centered
		>
			<div className={cx(styles.body)}>
				{!!previewDetail && visible && <>{RenderComponent}</>}
			</div>
		</MagicModal>
	)
}

export default memo(forwardRef(PreviewDetailPopup))
