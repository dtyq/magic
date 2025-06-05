import { useEffect, useMemo, useState } from "react"
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
import { useConversationMessage } from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageItem/components/ConversationMessageProvider/hooks"
import { useMemoizedFn } from "ahooks"
import { Empty, message, Modal } from "antd"
import useSendMessage from "@/opensource/pages/chatNew/hooks/useSendMessage"
import { useTranslation } from "react-i18next"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/ImagePreviewStore"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageImagePreview"
import { observer } from "mobx-react-lite"
import MessageReplyService from "@/opensource/services/chat/message/MessageReplyService"
import AiImage from "./componnents/AiImage"
import { useStyles } from "./styles"
import ErrorContent from "../../../../ErrorContent"

interface MagicAiImagesProps {
	type: ConversationMessageType.AiImage | ConversationMessageType.HDImage
	data?: AIImagesContent | HDImageContent
}

export type ResponseData = AIImagesContentItem & { old_file_id?: string }
interface Response {
	data: ResponseData[]
	isError: boolean
}

const MagicAiImages = observer(({ type, data }: MagicAiImagesProps) => {
	const { messageId } = useConversationMessage()

	const { previewInfo } = MessageFilePreviewStore

	const sendMessage = useSendMessage(messageId)

	const { t } = useTranslation("interface")

	const [currentType, setCurrentType] = useState<AIImagesDataType | HDImageDataType>()

	const { data: parsedData, isError } = useMemo(() => {
		const response: Response = {
			data: [],
			isError: false,
		}
		try {
			if (!data) return response
			setCurrentType(data?.type)
			switch (type) {
				case ConversationMessageType.AiImage:
					response.data = (data as AIImagesContent).items
					break
				case ConversationMessageType.HDImage:
					const newData = data as HDImageContent
					response.data = [
						{
							file_id: newData.new_file_id,
							old_file_id: newData.origin_file_id,
							url: "",
						},
					]
					break
				default:
					break
			}
			return response
		} catch (err) {
			console.error("data parse error", err)
			return { data: [], isError: true }
		}
	}, [data, type])

	const handleEdit = useMemoizedFn((item?: AIImagesContentItem) => {
		if (!item) return
		MessageReplyService.setReplyMessageId(messageId)
		MessageReplyService.setReplyFile(item?.file_id, data?.refer_text || "")
	})

	const handleToHD = useMemoizedFn((file_id?: string) => {
		if (!file_id) return
		Modal.confirm({
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
					if ((data as AIImagesContent)?.refer_file_id) return [{ key: "refer" }]
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
	}, [currentType, data, type])

	const length = useMemo(
		() => parsedData?.length || placeholders.length,
		[parsedData, placeholders],
	)

	const { styles } = useStyles({ count: length, ratio: data?.radio || "1:1" })

	const isToHDError =
		type === ConversationMessageType.HDImage && currentType === HDImageDataType.Error

	useEffect(() => {
		if (isToHDError && previewInfo?.fileId === (data as HDImageContent).origin_file_id) {
			message.error(data?.error_message || "生成失败")
			MessageFilePreviewService.setPreviewInfo({ ...previewInfo, useHDImage: false })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isToHDError])

	if (isError) {
		return <ErrorContent />
	}

	if (currentType === AIImagesDataType.Error || isToHDError) {
		return <div style={{ overflowY: "hidden" }}>{data?.error_message}</div>
	}

	if (type === ConversationMessageType.AiImage && currentType === AIImagesDataType.ReferImage) {
		return <div style={{ overflowY: "hidden" }}>{(data as AIImagesContent)?.text}</div>
	}

	if (!parsedData || parsedData.length === 0) {
		return placeholders.length > 0 ? (
			<div className={styles.container}>
				{placeholders.map((item) => {
					const { key } = item
					return <AiImage className={styles.imageItem} key={key} type={currentType} />
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
