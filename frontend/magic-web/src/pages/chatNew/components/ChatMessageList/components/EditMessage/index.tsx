import { Flex } from "antd"
import { type PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"
import MessageTextRender from "../MessageTextRender"
import { useStyles } from "./styles"
import MessageEditStore from "@/stores/chatNew/messageUI/Edit"
import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconCircleX } from "@tabler/icons-react"
import MessageEditService from "@/services/chat/message/MessageEditService"
import { useTranslation } from "react-i18next"

interface EditMessageProps extends PropsWithChildren {
	className?: string
	containerClassName?: string
	onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

function MessageEditComponent({ className, containerClassName, onClick }: EditMessageProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")
	const editMessage = MessageEditStore.editMessage

	if (!editMessage) return null

	return (
		<Flex align="center" justify="space-between" className={containerClassName}>
			<Flex vertical className={cx(styles.container, className)} gap={2} onClick={onClick}>
				<span className={styles.title}>{t("chat.editMessage.title")}</span>
				<div className={styles.content}>
					<MessageTextRender
						messageId={editMessage.message_id}
						message={editMessage.message}
					/>
				</div>
			</Flex>
			<MagicButton
				type="text"
				icon={<MagicIcon size={20} component={IconCircleX} />}
				onClick={MessageEditService.resetEditMessageId}
			/>
		</Flex>
	)
}

const MessageEdit = observer(MessageEditComponent)

export default MessageEdit
