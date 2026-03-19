import { MessageReceiveType } from "@/types/chat"

/**
 * 是否是 AI 会话
 * @param receive_type
 * @returns
 */
export const isAiConversation = (receive_type?: MessageReceiveType) => {
	if (receive_type === MessageReceiveType.Ai) {
		return true
	}
	return false
}
