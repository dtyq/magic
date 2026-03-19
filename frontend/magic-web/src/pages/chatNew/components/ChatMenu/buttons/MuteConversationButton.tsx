import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import conversationStore from "@/stores/chatNew/conversation"
import conversationService from "@/services/chat/conversation/ConversationService"
import chatMenuStore from "@/stores/chatNew/chatMenu"
import { IconMessage2Cancel } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"

const MuteConversationButton = observer(({ conversationId }: { conversationId: string }) => {
	const { t } = useTranslation("interface")
	const { conversations } = conversationStore
	const conversation = conversations[conversationId]

	const handleClick = useMemoizedFn(() => {
		if (!conversation) return
		const isNotDisturb = conversation.is_not_disturb ? 0 : 1
		conversationService.setNotDisturbStatus(conversation.id, isNotDisturb)
		chatMenuStore.closeMenu()
	})

	if (!conversation) return null

	return (
		<MagicButton
			justify="flex-start"
			icon={<MagicIcon component={IconMessage2Cancel} size={20} />}
			size="large"
			type="text"
			block
			onClick={handleClick}
		>
			{conversation.is_not_disturb
				? t("chat.floatButton.disableNoDisturbing")
				: t("chat.floatButton.enableNoDisturbing")}
		</MagicButton>
	)
})

export default MuteConversationButton
