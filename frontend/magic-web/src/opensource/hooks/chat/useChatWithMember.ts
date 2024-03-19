import { MessageReceiveType } from "@/opensource/types/chat"
import { useMemoizedFn } from "ahooks"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import { useIsMobile } from "../useIsMobile"
import { RouteName } from "@/opensource/routes/constants"

/**
 * 与成员聊天
 * @param uid 成员id
 * @returns 发送消息
 */
export const useChatWithMember = () => {
	const navigate = useNavigate()
	const isMobile = useIsMobile()

	const chatWith = useMemoizedFn(
		(
			uid?: string,
			receiveType: MessageReceiveType = MessageReceiveType.User,
			navigateToChat = true,
		) => {
			if (!uid) return Promise.reject(new Error("uid is required"))

			return conversationService.createConversation(receiveType, uid).then((conversation) => {
				if (conversation) {
					conversationService.switchConversation(conversation)
					if (navigateToChat) {
						if (isMobile) {
							navigate({ name: RouteName.ChatConversation })
						} else {
							navigate({ name: RouteName.Chat })
						}
					}
				}
				return conversation
			})
		},
	)

	return chatWith
}
