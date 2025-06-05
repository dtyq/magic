import { Flex } from "antd"
import MagicMemberAvatar from "@/opensource/components/business/MagicMemberAvatar"
import { formatFileSize, formatTime } from "@/utils/string"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconBadgeHd, IconDownload, IconMessagePin, IconShare3 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import type {
	ConversationMessage,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"

import type { SeqResponse } from "@/types/request"
import { useMemo } from "react"
import type { MouseEvent } from "react"
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "@/const/file"
import useUserInfo from "@/opensource/hooks/chat/useUserInfo"
import { getUserName } from "@/utils/modules/chat"
import type { ImagePreviewInfo } from "@/types/chat/preview"
import { useStyles } from "./styles"

interface ChatImagePreviewHeader {
	onMouseOut?: () => void
	onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void
	onMouseOver?: () => void
	onDownload?: () => void
	onHighDefinition?: () => void
	navigateToMessage?: () => void
	message?: SeqResponse<ConversationMessage> | ConversationMessageSend
	info?: ImagePreviewInfo
	className?: string
}

function Header(props: ChatImagePreviewHeader) {
	const {
		info,
		message,
		className,
		onMouseOut,
		onMouseOver,
		onMouseDown,
		onDownload,
		onHighDefinition,
		navigateToMessage,
	} = props

	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")

	const username = getUserName(useUserInfo(message?.message?.sender_id).userInfo)

	const title = useMemo(() => {
		switch (true) {
			case IMAGE_EXTENSIONS.includes(info?.ext?.ext ?? ""):
			case message?.message?.type === ConversationMessageType.Image:
				return t("chat.imagePreview.senderImage", { username })
			case VIDEO_EXTENSIONS.includes(info?.ext?.ext ?? ""):
			case message?.message?.type === ConversationMessageType.Video:
				return t("chat.imagePreview.senderVideo", { username })
			case message?.message?.type === ConversationMessageType.Files:
				return t("chat.imagePreview.senderFiles", { username })
			default:
				return t("chat.imagePreview.defaultTitle")
		}
	}, [info?.ext?.ext, message?.message?.type, t, username])

	return (
		<Flex
			align="center"
			justify="space-between"
			gap={10}
			className={cx(styles.headerInnerContainer, className)}
			style={{ width: "100%", cursor: "move" }}
			onMouseOver={onMouseOver}
			onMouseOut={onMouseOut}
			onMouseDown={onMouseDown}
		>
			<Flex gap={10}>
				<MagicMemberAvatar uid={message?.message?.sender_id} showPopover={false} />
				<Flex vertical gap={2}>
					<div className={styles.title}>{title}</div>
					<div className={styles.subtitle}>
						{formatTime(message?.message?.send_time)} · {formatFileSize(info?.fileSize)}
					</div>
				</Flex>
			</Flex>
			<Flex gap={10}>
				<MagicButton type="text" className={styles.headerButton} onClick={onHighDefinition}>
					<Flex vertical align="center" justify="center">
						<MagicIcon color="currentColor" component={IconBadgeHd} size={20} />
						<span>{t("chat.imagePreview.highDefinitionImage")}</span>
					</Flex>
				</MagicButton>
				<MagicButton
					hidden={!info?.messageId}
					type="text"
					className={styles.headerButton}
					onClick={navigateToMessage}
				>
					<Flex vertical align="center" justify="center">
						<MagicIcon color="currentColor" component={IconMessagePin} size={20} />
						<span>{t("chat.imagePreview.navigateToMessage")}</span>
					</Flex>
				</MagicButton>
				<MagicButton type="text" className={styles.headerButton}>
					<Flex vertical align="center" justify="center">
						<MagicIcon color="currentColor" component={IconShare3} size={20} />
						<span>{t("chat.imagePreview.transpond")}</span>
					</Flex>
				</MagicButton>
				<MagicButton type="text" className={styles.headerButton} onClick={onDownload}>
					<Flex vertical align="center" justify="center">
						<MagicIcon color="currentColor" component={IconDownload} size={20} />
						<span>{t("chat.imagePreview.download")}</span>
					</Flex>
				</MagicButton>
			</Flex>
		</Flex>
	)
}

export default Header
