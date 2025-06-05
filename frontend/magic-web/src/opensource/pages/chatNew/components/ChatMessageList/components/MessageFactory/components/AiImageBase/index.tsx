import { useEffect, useMemo } from "react"
import type {
	AIImagesContentItem,
	AIImagesContent,
	HDImageContent,
} from "@/types/chat/conversation_message"
import {
	HDImageDataType,
	ConversationMessageType,
	AIImagesDataType,
} from "@/types/chat/conversation_message"
import { useMemoizedFn } from "ahooks"
import { Empty, Flex, message } from "antd"
import useSendMessage from "@/opensource/pages/chatNew/hooks/useSendMessage"
import { useTranslation } from "react-i18next"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/ImagePreviewStore"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageImagePreview"
import MessageReplyService from "@/opensource/services/chat/message/MessageReplyService"
import { observer } from "mobx-react-lite"
import useApp from "antd/es/app/useApp"
import AiImage from "./componnents/AiImage"
import { useStyles } from "./styles"
import ErrorContent from "../ErrorContent"

export interface MagicAiImagesProps {
	messageId: string
	type: ConversationMessageType.AiImage | ConversationMessageType.HDImage
	content?: AIImagesContent | HDImageContent
}

export type ResponseData = AIImagesContentItem & { old_file_id?: string }
interface Response {
	data: ResponseData[]
	type: AIImagesDataType | HDImageDataType
	isError: boolean
}

const MagicAiImages = observer(({ type, content, messageId }: MagicAiImagesProps) => {
	const previewFileInfo = MessageFilePreviewStore.previewInfo

	const sendMessage = useSendMessage(messageId)
	const { modal } = useApp()

	const { t } = useTranslation("interface")

	const {
		data: parsedData,
		type: currentType,
		isError,
	} = useMemo(() => {
		const response: Response = {
			data: [],
			type: AIImagesDataType.StartGenerate,
			isError: false,
		}
		try {
			if (!content) return response
			switch (type) {
				case ConversationMessageType.AiImage:
					response.data = (content as AIImagesContent).items
					response.type = content?.type
					break
				case ConversationMessageType.HDImage:
					const newData = content as HDImageContent
					response.data = [
						{
							file_id: newData.new_file_id,
							old_file_id: newData.origin_file_id,
							url: "",
						},
					]
					response.type = content?.type
					break
				default:
					break
			}
			return response
		} catch (err) {
			console.error("data parse error", err)
			return { data: [], type: AIImagesDataType.Error, isError: true }
		}
	}, [content, type])

	const handleEdit = useMemoizedFn((item?: AIImagesContentItem) => {
		if (!item) return
		MessageReplyService.setReplyMessageId(messageId)
		MessageReplyService.setReplyFile(item?.file_id, content?.refer_text || "")
	})

	const handleToHD = useMemoizedFn((file_id?: string) => {
		if (!file_id) return
		modal.confirm({
			title: t("chat.imagePreview.highDefinitionImage"),
			content: t("chat.imagePreview.useHightImageTip"),
			onOk() {
				sendMessage({
					type: ConversationMessageType.Text,
					text: {
						content: "转超清",
						attachments: [{ file_id }],
					},
				})
			},
		})
	})

	const placeholders = useMemo(() => {
		switch (type) {
			case ConversationMessageType.AiImage:
				if (currentType === AIImagesDataType.StartGenerate) {
					if ((content as AIImagesContent)?.refer_file_id) return [{ key: "refer" }]
					return Array.from({ length: 4 }).map((_, index) => ({
						key: `placeholder-${index}`,
					}))
				}
				return []
			case ConversationMessageType.HDImage:
				if (currentType === AIImagesDataType.StartGenerate) {
					return [{ key: "placeholder" }]
				}
				return []
			default:
				return []
		}
	}, [currentType, content, type])

	const length = useMemo(
		() => parsedData?.length || placeholders.length,
		[parsedData, placeholders],
	)

	const { styles } = useStyles({ count: length, ratio: content?.radio || "1:1" })

	const isToHDError =
		type === ConversationMessageType.HDImage && currentType === HDImageDataType.Error

	useEffect(() => {
		if (isToHDError && previewFileInfo?.fileId === (content as HDImageContent).origin_file_id) {
			message.error(content?.error_message || "生成失败")
			MessageFilePreviewService.setPreviewInfo({
				...previewFileInfo,
				useHDImage: false,
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isToHDError])

	if (isError) {
		return <ErrorContent />
	}

	if (currentType === AIImagesDataType.Error || isToHDError) {
		return <div style={{ overflowY: "hidden" }}>{content?.error_message}</div>
	}

	if (type === ConversationMessageType.AiImage && currentType === AIImagesDataType.ReferImage) {
		return <div style={{ overflowY: "hidden" }}>{(content as AIImagesContent)?.text}</div>
	}

	if (!parsedData || parsedData.length === 0) {
		return placeholders.length > 0 ? (
			<div className={styles.container}>
				{placeholders.map((item) => {
					const { key } = item
					return (
						<AiImage
							className={styles.imageItem}
							key={key}
							type={currentType}
							messageId={messageId}
						/>
					)
				})}
			</div>
		) : (
			<Empty />
		)
	}

	return (
		<div className={styles.container}>
			{parsedData?.map((item) => {
				const { file_id: key, old_file_id } = item
				return (
					<AiImage
						className={styles.imageItem}
						alt={key}
						messageId={messageId}
						key={key}
						fileId={key}
						oldFileId={old_file_id}
						type={currentType}
						item={item}
						onEdit={handleEdit}
						onToHD={handleToHD}
					/>
				)
			})}
		</div>
	)
})

export default MagicAiImages
