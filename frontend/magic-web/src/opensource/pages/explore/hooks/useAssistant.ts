import { useMemoizedFn } from "ahooks"
import { MessageReceiveType } from "@/opensource/types/chat"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { RouteName } from "@/opensource/routes/constants"

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
