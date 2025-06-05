import { Flex } from "antd"
import MagicMemberAvatar from "@/opensource/components/business/MagicMemberAvatar"
import { formatFileSize, formatTime } from "@/utils/string"
import MagicButton from "@/opensource/components/base/MagicButton"
import { IconBadgeHd, IconDownload, IconMessagePin, IconShare3 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import type { ConversationMessage } from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import { useEffect, useMemo, useState } from "react"
import type { MouseEvent } from "react"
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "@/const/file"
import { getUserName } from "@/utils/modules/chat"
import type { ImagePreviewInfo } from "@/types/chat/preview"
import { useStyles } from "./styles"
import { SeqResponse } from "@/types/request"
import { FullMessage } from "@/types/chat/message"
import userInfoService from "@/opensource/services/userInfo"
import { StructureUserItem } from "@/types/organization"
import { useMount } from "ahooks"
import userInfoStore from "@/opensource/stores/userInfo"
interface ChatImagePreviewHeader {
	onMouseOut?: () => void
	onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void
	onMouseOver?: () => void
	onDownload?: () => void
	onHighDefinition?: () => void
	navigateToMessage?: () => void
	message?: SeqResponse<ConversationMessage> | FullMessage<ConversationMessage>
	info?: ImagePreviewInfo
	loading?: boolean
	className?: string
}

function Header(props: ChatImagePreviewHeader) {
	const {
		info,
		loading,
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

	const [userInfo, setUserInfo] = useState<StructureUserItem | undefined>(undefined)

	useMount(() => {
		const userInfo = message?.message?.sender_id
			? userInfoStore.get(message?.message?.sender_id)
			: undefined
		if (!userInfo) {
			userInfoService.fetchUserInfos([message?.message?.sender_id ?? ""], 2).then((res) => {
				setUserInfo(res[0])
			})
		} else {
			setUserInfo(userInfo)
		}
	})

	const username = getUserName(userInfo)

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

	const subTitle = useMemo(() => {
		if (!message?.message?.send_time && !info?.fileSize) return ""

		if (!message?.message?.send_time) return formatFileSize(info?.fileSize)

		if (!info?.fileSize) return formatTime(message?.message?.send_time)

		return `${formatTime(message?.message?.send_time)} · ${formatFileSize(info?.fileSize)}`
	}, [message?.message?.send_time, info?.fileSize])

	const hdText = useMemo(() => {
		if (loading) {
			return t("chat.imagePreview.converting")
		}
		if (info?.oldFileId) {
			return t("chat.imagePreview.hightImageConverted")
		}
		return t("chat.imagePreview.highDefinitionImage")
	}, [info?.oldFileId, loading, t])

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
					<div className={styles.subtitle}>{subTitle}</div>
				</Flex>
			</Flex>
			<Flex gap={10}>
				{info?.useHDImage && (
					<MagicButton
						type="text"
						className={styles.headerButton}
						onClick={onHighDefinition}
						disabled={loading || !!info?.oldFileId}
					>
						<Flex vertical align="center" justify="center">
							<IconBadgeHd className={styles.icon} size={20} />
							<span>{hdText}</span>
						</Flex>
					</MagicButton>
				)}
				<MagicButton
					hidden={!info?.messageId}
					type="text"
					className={styles.headerButton}
					onClick={navigateToMessage}
				>
					<Flex vertical align="center" justify="center">
						<IconMessagePin className={styles.icon} size={20} />
						<span>{t("chat.imagePreview.navigateToMessage")}</span>
					</Flex>
				</MagicButton>
				<MagicButton type="text" className={styles.headerButton}>
					<Flex vertical align="center" justify="center">
						<IconShare3 className={styles.icon} size={20} />
						<span>{t("chat.imagePreview.transpond")}</span>
					</Flex>
				</MagicButton>
				<MagicButton type="text" className={styles.headerButton} onClick={onDownload}>
					<Flex vertical align="center" justify="center">
						<IconDownload className={styles.icon} size={20} />
						<span>{t("chat.imagePreview.download")}</span>
					</Flex>
				</MagicButton>
			</Flex>
		</Flex>
	)
}

export default Header
