import { BotApi } from "@/apis"
import { useIsMobile } from "@/hooks/useIsMobile"
import useNavigate from "@/routes/hooks/useNavigate"
import ConversationService from "@/services/chat/conversation/ConversationService"
import { AgentIdKey, UserIdKey } from "./utils/conversationReceiveIdStorage"
import { MessageReceiveType } from "@/types/chat"
import { useMount } from "ahooks"
import { RouteName } from "@/routes/constants"

/**
 * 在url中携带agent_id参数时，自动创建会话
 */
const useNavigateConversationByAgentIdInSearchQuery = () => {
	const navigate = useNavigate()

	const isMobile = useIsMobile()

	useMount(() => {
		const agentId = window.sessionStorage.getItem(AgentIdKey)
		if (agentId) {
			BotApi.registerAndAddFriend(agentId)
				.then((res) => {
					return ConversationService.createConversation(
						MessageReceiveType.Ai,
						res.user_id,
					)
				})
				.then((res) => {
					if (res?.id) {
						ConversationService.switchConversation(res)
						window.sessionStorage.removeItem(AgentIdKey)

						if (isMobile) {
							navigate({
								name: RouteName.ChatConversation,
								query: {
									conversation_id: res.id,
								},
							})
						} else {
							// 跳转到 Chat 页面
							navigate({
								name: RouteName.Chat,
								query: {
									conversation_id: res.id,
								},
							})
						}
					}
				})
				.catch((err) => {
					console.error("err", err)
				})
		}
		const userId = window.sessionStorage.getItem(UserIdKey)
		if (userId) {
			ConversationService.createConversation(MessageReceiveType.User, userId)
				.then((res) => {
					if (res?.id) {
						ConversationService.switchConversation(res)
						window.sessionStorage.removeItem(UserIdKey)
						if (isMobile) {
							navigate({
								name: RouteName.ChatConversation,
								query: {
									conversation_id: res.id,
								},
							})
						} else {
							// 跳转到 Chat 页面
							navigate({
								name: RouteName.Chat,
								query: {
									conversation_id: res.id,
								},
							})
						}
					}
				})
				.catch((err) => {
					console.error("err", err)
				})
		}
	})
}

export default useNavigateConversationByAgentIdInSearchQuery
