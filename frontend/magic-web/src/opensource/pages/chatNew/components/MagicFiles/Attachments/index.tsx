import type { MouseEventHandler } from "react"
import type { ConversationMessageAttachment } from "@/types/chat/conversation_message"

import { useMemo, useState } from "react"
import { Flex, Skeleton } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { IconCloudDownload, IconEye } from "@tabler/icons-react"

import FileIcon from "@/opensource/components/business/FileIcon"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import useChatFileUrls from "@/opensource/hooks/chat/useChatFileUrls"
import { useConversationMessage } from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageItem/components/ConversationMessageProvider/hooks"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageFilePreview"
import { formatFileSize } from "@/utils/string"

import { FILE_ITEM_GAP, useStyles } from "./styles"
import { getListHeight } from "./utils"

interface MessageAttachmentsProps {
	data?: ConversationMessageAttachment[]
	maxCount?: number
	onDownload?: (fileId: string) => void
	onPreview?: (fileInfo: ConversationMessageAttachment) => void
	isLoading?: boolean
}

/**
 * 消息附件列表
 * @param param0
 * @returns
 */
const Attachments = ({
	data,
	maxCount = 4,
	onDownload,
	onPreview,
	isLoading,
}: MessageAttachmentsProps) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")
	const { isUnReceived } = useConversationMessage()

	const { messageId } = useConversationMessage()
	const { data: urls } = useChatFileUrls(
		useMemo(
			() =>
				messageId
					? data?.map((item) => ({ file_id: item.file_id, message_id: messageId }))
					: [],
			[data, messageId],
		),
	)

	const [expanded, setExpanded] = useState(false)

	const height = useMemo(() => {
		if (!data) return 0
		return getListHeight(expanded ? data.length : Math.min(maxCount, data.length))
	}, [expanded, data, maxCount])

	const handleClickFile = useMemoizedFn<MouseEventHandler<HTMLDivElement>>((e) => {
		e.stopPropagation()
	})

	if (!data || !data || data.length === 0) return null

	const loading = isLoading || isUnReceived

	return (
		<div className={styles.container}>
			<Flex gap={FILE_ITEM_GAP} vertical className={styles.fileList} style={{ height }}>
				{data?.map((file) => (
					<Flex
						key={file.file_id}
						className={styles.fileItem}
						align="center"
						gap={8}
						onClick={handleClickFile}
					>
						<FileIcon
							src={urls?.[file.file_id]?.url}
							ext={file.file_extension}
							size={16}
						/>
						<Flex vertical flex={1}>
							<Skeleton
								active
								paragraph={false}
								loading={loading}
								style={{ width: 80 }}
							>
								<span className={styles.fileName}>{file.file_name}</span>
							</Skeleton>
							<Skeleton
								active
								paragraph={false}
								loading={loading}
								style={{ width: 40 }}
							>
								<span className={styles.fileSize}>
									{formatFileSize(file.file_size)}
								</span>
							</Skeleton>
						</Flex>

						<Flex gap={4}>
							<MagicButton
								className={styles.controlButton}
								type="text"
								size="small"
								hidden={!MessageFilePreviewService.canPreview(file)}
								onClick={() => onPreview?.(file)}
							>
								<MagicIcon component={IconEye} size={18} />
							</MagicButton>
							<MagicButton
								className={styles.controlButton}
								type="text"
								size="small"
								onClick={() => onDownload?.(file.file_id)}
							>
								<MagicIcon component={IconCloudDownload} size={18} />
							</MagicButton>
							{/* <MagicButton className={styles.controlButton} type="text" size="small">
								<MagicIcon component={IconDeviceFloppy} size={18} />
							</MagicButton> */}
						</Flex>
					</Flex>
				))}
			</Flex>
			{maxCount < data.length ? (
				<div className={styles.more} onClick={() => setExpanded(!expanded)}>
					{expanded
						? t("chat.messageAttachments.collapse")
						: resolveToString(t("chat.messageAttachments.expandAllFiles"), {
								count: data.length,
						  })}
				</div>
			) : null}
		</div>
	)
}

export default Attachments
