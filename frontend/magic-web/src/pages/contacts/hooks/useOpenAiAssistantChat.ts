import { useMemoizedFn } from "ahooks"
import { BotApi } from "@/apis"
import type { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import { useChatWithMember } from "@/hooks/chat/useChatWithMember"
import { MessageReceiveType } from "@/types/chat"

interface OpenAiAssistantChatParams {
	id: UserAvailableAgentInfo["id"]
	user_id?: UserAvailableAgentInfo["user_id"]
}

export function useOpenAiAssistantChat() {
	const chatWith = useChatWithMember()

	return useMemoizedFn(async ({ id, user_id }: OpenAiAssistantChatParams) => {
		const userId = user_id || (await BotApi.registerAndAddFriend(id)).user_id

		if (!userId) return null

		return chatWith(userId, MessageReceiveType.Ai, true)
	})
}
