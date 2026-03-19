import { memo, useCallback, type MouseEvent } from "react"
import type { JSONContent } from "@tiptap/core"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	getMentionDescription,
	getMentionDisplayName,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { showMobileImagePreview } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MobileImagePreview"
import { useMarkerImageUrl } from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useMarkerImageUrl"
import { useTransformedMarkerData } from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useTransformedMarkerData"
import { MentionTooltipWrapper } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MentionTooltipWrapper"
import MarkerAtItem from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/MarkerAtItem"
import {
	type MarkerClickScene,
	useMarkerClickHandler,
} from "@/pages/superMagic/components/MessageEditor/hooks/useMarkerClickHandler"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"

interface InlineMentionProps {
	data: TiptapMentionAttributes
	onFileClick?: (item: TiptapMentionAttributes["data"]) => void
	markerClickScene?: MarkerClickScene
	messageContent?: JSONContent | string | Record<string, unknown>
}

function InlineMarkerMention(props: InlineMentionProps) {
	const { data, markerClickScene = "messageList", messageContent } = props

	return (
		<span className="magic-marker-mention inline-flex align-bottom">
			<MarkerAtItem
				data={data}
				markerClickScene={markerClickScene}
				messageContent={messageContent}
			/>
		</span>
	)
}

function InlineDefaultMention(props: InlineMentionProps) {
	const { data, onFileClick, markerClickScene = "messageList", messageContent } = props

	const isMobile = useIsMobile()
	const displayName = getMentionDisplayName(data)
	const description = getMentionDescription(data)
	const isInMessageList = true

	const { markerData: transformedMarkerData, loading: markerLoading } = useTransformedMarkerData(
		data,
		isInMessageList,
	)
	const { imageUrl: markerImageUrl } = useMarkerImageUrl(transformedMarkerData?.image_path)
	const { handleMarkerClick } = useMarkerClickHandler({
		scene: markerClickScene,
		disabled: markerClickScene === "draftBox",
		transformedMarkerData,
		messageContent,
	})

	const handleClick = useCallback(
		(event: MouseEvent<HTMLSpanElement>) => {
			event.preventDefault()
			event.stopPropagation()

			if (data.type === MentionItemType.DESIGN_MARKER) {
				handleMarkerClick(data)
				return
			}

			if (!onFileClick) {
				if (data.type === MentionItemType.PROJECT_FILE && isMobile) {
					const fileData = data.data as ProjectFileMentionData
					const extension =
						fileData.file_extension || fileData.file_name.split(".").pop() || ""

					if (fileData.file_id && getFileType(extension) === "image") {
						showMobileImagePreview({
							alt: fileData.file_name,
							file_id: fileData.file_id,
						})
					}
				}

				if (data.type === MentionItemType.UPLOAD_FILE && isMobile) {
					const fileData = data.data as UploadFileMentionData
					const file = fileData.file
					const fileExtension =
						fileData.file_extension || file?.type.split("/").pop() || ""

					if (file && getFileType(fileExtension) === "image") {
						showMobileImagePreview({
							alt: fileData.file_name,
							file,
						})
					}
				}

				return
			}

			if (data.type === MentionItemType.PROJECT_FILE) {
				onFileClick(data.data)
			}
		},
		[data, handleMarkerClick, isMobile, onFileClick],
	)

	const label = data.type === MentionItemType.FOLDER ? `@${displayName}/` : `@${displayName}`

	return (
		<MentionTooltipWrapper
			data={data}
			displayName={displayName}
			description={description}
			isInMessageList={isInMessageList}
			transformedMarkerData={transformedMarkerData}
			markerLoading={markerLoading}
			markerImageUrl={markerImageUrl}
		>
			<span
				className="magic-mention"
				data-type={data.type}
				data-data={JSON.stringify(data.data)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={handleClick}
			>
				{label}
			</span>
		</MentionTooltipWrapper>
	)
}

function InlineMention(props: InlineMentionProps) {
	if (props.data.type === MentionItemType.DESIGN_MARKER) {
		return <InlineMarkerMention {...props} />
	}

	return <InlineDefaultMention {...props} />
}

export default memo(InlineMention)
