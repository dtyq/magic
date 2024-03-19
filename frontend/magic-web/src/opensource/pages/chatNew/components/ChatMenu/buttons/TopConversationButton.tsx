import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import chatMenuStore from "@/opensource/stores/chatNew/chatMenu"
import { IconPin } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

const TopConversationButton = observer(({ conversationId }: { conversationId: string }) => {
	const { t } = useTranslation("interface")
	const { conversations } = conversationStore
	const conversation = conversations[conversationId]

	const onClick = useMemoizedFn(() => {
		if (!conversation) return
		const isTop = conversation.is_top ? 0 : 1
		conversationService.setTopStatus(conversationId, isTop)
		chatMenuStore.closeMenu()
	})

	if (!conversation) return null

	return (
		<MagicButton
			justify="flex-start"
			icon={<MagicIcon component={IconPin} size={20} />}
			size="large"
			type="text"
			block
			onClick={onClick}
		>
			{conversation.is_top
				? t("chat.floatButton.cancelTopConversation")
				: t("chat.floatButton.topConversation")}
		</MagicButton>
	)
})

export default TopConversationButton
