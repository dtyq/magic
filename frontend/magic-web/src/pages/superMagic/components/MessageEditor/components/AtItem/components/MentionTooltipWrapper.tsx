import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Tooltip, type TooltipProps } from "antd"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	type CanvasMarkerMentionData,
	MentionItemType,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import MarkerTooltip from "../../MentionNodes/marker"
import { MentionTooltipContent } from "./MentionTooltipContent"
import { MediaPreviewTrigger, type MediaPreviewSource } from "@/components/base/MediaPreview"
import {
	useMentionMediaSource,
	type MentionMediaSource,
} from "../../MentionMedia/useMentionMediaSource"
import {
	DEFAULT_FILE_MENTION_RENDER_CONFIG,
	isFileMentionFeatureEnabled,
	getFileMentionRenderType,
	type FileMentionRenderConfig,
} from "../../MentionMedia/fileMentionRenderConfig"

interface MentionTooltipWrapperProps {
	children: ReactElement
	data: TiptapMentionAttributes
	displayName?: string
	description?: string
	isInMessageList: boolean
	placement?: TooltipProps["placement"]
	tooltipProps?: Partial<TooltipProps>
	markerTooltipProps?: {
		popoverClassName?: string
		parentPopoverOpen?: boolean
		side?: "top" | "right" | "bottom" | "left"
	}
	transformedMarkerData?: CanvasMarkerMentionData | null
	markerLoading?: boolean
	markerImageUrl?: string | null
	mediaSource?: MentionMediaSource
	fileMentionRenderConfig?: FileMentionRenderConfig
}

export function MentionTooltipWrapper(props: MentionTooltipWrapperProps) {
	const {
		children,
		data,
		displayName,
		description,
		isInMessageList,
		placement,
		tooltipProps,
		markerTooltipProps,
		transformedMarkerData,
		markerLoading,
		markerImageUrl,
		mediaSource: providedMediaSource,
		fileMentionRenderConfig = DEFAULT_FILE_MENTION_RENDER_CONFIG,
	} = props

	const isMobile = useIsMobile()
	const { t } = useTranslation("super")
	const ownMediaSource = useMentionMediaSource({
		data,
		uploadFile:
			data.type === MentionItemType.UPLOAD_FILE
				? (data.data as UploadFileMentionData).file
				: null,
		enabled: !isMobile && !providedMediaSource,
	})
	const mediaSource = providedMediaSource ?? ownMediaSource
	const mediaType = mediaSource.mediaType

	if (isMobile) {
		return children
	}

	if (data.type === MentionItemType.DESIGN_MARKER) {
		return (
			<MarkerTooltip
				markerData={transformedMarkerData ?? null}
				isInMessageList={isInMessageList}
				loading={markerLoading}
				popoverClassName={markerTooltipProps?.popoverClassName}
				parentPopoverOpen={markerTooltipProps?.parentPopoverOpen}
				side={markerTooltipProps?.side}
				imageUrl={markerImageUrl}
			>
				{children}
			</MarkerTooltip>
		)
	}

	const renderType = getFileMentionRenderType(mediaType)
	const previewSource: MediaPreviewSource | null = mediaType
		? (mediaSource as MediaPreviewSource)
		: null
	const shouldRenderMediaPreview =
		mediaSource.isLoading ||
		Boolean(
			mediaSource.thumbnailUrl ||
			mediaSource.thumbnailElement ||
			mediaSource.previewUrl ||
			mediaSource.poster ||
			mediaSource.audioUrl,
		) ||
		mediaSource.hasError

	if (
		mediaType &&
		isFileMentionFeatureEnabled("tooltip", renderType, fileMentionRenderConfig) &&
		shouldRenderMediaPreview
	) {
		return (
			<MediaPreviewTrigger
				fileName={displayName || ""}
				source={previewSource}
				fallback={children}
				renderTrigger={() => children}
				labels={{
					errorMessage: t("common.fileNotFoundOrLoadFailed", "文件不存在或加载错误"),
					audioLabels: {
						play: t("common.play", "播放"),
						pause: t("common.pause", "暂停"),
						loading: t("common.loading", "加载中"),
						progress: t("common.progress", "播放进度"),
					},
				}}
				side={
					placement?.startsWith("left")
						? "left"
						: placement?.startsWith("right")
							? "right"
							: placement?.startsWith("bottom")
								? "bottom"
								: "top"
				}
				enableTouchTrigger={false}
			/>
		)
	}

	// 文件 Mention 的 Tooltip 由文件类型配置独立控制；未启用时保持原节点。
	const isFileMention =
		data.type === MentionItemType.PROJECT_FILE || data.type === MentionItemType.UPLOAD_FILE
	if (isFileMention) return children

	return (
		<Tooltip
			{...tooltipProps}
			title={
				<MentionTooltipContent
					data={data}
					displayName={displayName}
					description={description}
				/>
			}
			placement={placement}
		>
			{children}
		</Tooltip>
	)
}
