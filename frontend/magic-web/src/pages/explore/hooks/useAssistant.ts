import { useMemoizedFn } from "ahooks"
import { MessageReceiveType } from "@/types/chat"
import useNavigate from "@/routes/hooks/useNavigate"
import ConversationService from "@/services/chat/conversation/ConversationService"
import { useIsMobile } from "@/hooks/useIsMobile"
import { RouteName } from "@/routes/constants"

export default function useAssistant() {
	const navigate = useNavigate()
	const isMobile = useIsMobile()

	const navigateConversation = useMemoizedFn(async (user_id: string) => {
		const conversation = await ConversationService.createConversation(
			MessageReceiveType.Ai,
			`${user_id}`,
		)

		if (conversation) {
			ConversationService.switchConversation(conversation)
			if (isMobile) {
				navigate({
					name: RouteName.ChatConversation,
					viewTransition: { type: "slide", direction: "left" },
				})
			} else {
				navigate({
					name: RouteName.Chat,
				})
			}
		}
	})

	return {
		navigateConversation,
	}
}
