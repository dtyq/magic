import { memo } from "react"
import { Flex, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { IconAlertCircleFilled } from "@tabler/icons-react"
import { SendStatus } from "@/opensource/types/chat/conversation_message"
import MessageStore from "@/opensource/stores/chatNew/message"
import MessageService from "@/opensource/services/chat/message/MessageService"
import { observer } from "mobx-react-lite"
import useStyles from "./styles"

interface MessageSendStatusProps {
	messageId: string
}

const MessageSendStatus = observer(({ messageId }: MessageSendStatusProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const sendStatus = MessageStore.sendStatusMap.get(messageId)

	if (!sendStatus) return null

	const renderStatus = () => {
		switch (sendStatus) {
			case SendStatus.Pending:
				return (
					<Flex align="center" justify="flex-end" gap={2} className={styles.text}>
						{t("chat.sending")}
					</Flex>
				)
			case SendStatus.Failed:
				return (
					<Tooltip title={t("chat.resend")}>
						<Flex align="center" justify="flex-end" gap={2} className={styles.error}>
							<IconAlertCircleFilled
								size={14}
								onClick={() => {
									MessageService.resendMessage(messageId)
								}}
							/>
							{t("chat.sendFailed")}
						</Flex>
					</Tooltip>
				)
			default:
				return null
		}
	}

	return renderStatus()
})

export default memo(MessageSendStatus)
