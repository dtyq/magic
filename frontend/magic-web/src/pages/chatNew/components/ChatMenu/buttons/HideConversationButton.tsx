import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconMessage2X } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import conversationStore from "@/stores/chatNew/conversation"
import conversationService from "@/services/chat/conversation/ConversationService"
import chatMenuStore from "@/stores/chatNew/chatMenu"
import { ChatApi } from "@/apis"
import { userStore } from "@/models/user"

const HideConversationButton = observer(({ conversationId }: { conversationId: string }) => {
	const { t } = useTranslation("interface")
	const { organizationCode } = userStore.user
	const { conversations } = conversationStore
	const conversation = conversations[conversationId]

	const handleHideConversation = useMemoizedFn(() => {
		if (!organizationCode || !conversation) return

		conversationService.deleteConversation(conversation.id)

		ChatApi.hideConversation(conversation.id)
		chatMenuStore.closeMenu()
	})

	if (!conversation) return null

	return (
		<MagicButton
			justify="flex-start"
			icon={<MagicIcon color="currentColor" component={IconMessage2X} size={20} />}
			size="large"
			type="text"
			danger
			block
			onClick={handleHideConversation}
		>
			{t("chat.floatButton.removeGroup")}
		</MagicButton>
	)
})

export default HideConversationButton
