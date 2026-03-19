import { ChatApi } from "@/apis"
import type { Bot } from "@/types/bot"
import type { SWRMutationResponse } from "swr/mutation"
import useSWRMutation from "swr/mutation"

/**
 * 获取 AI助理对应的机器人信息
 * @param user_id 用户ID
 * @returns
 */
const useAiAssistantBotInfo = (
	user_id?: string,
): SWRMutationResponse<
	Bot.Detail["botEntity"],
	Error,
	[string, "/api/v1/agents/versions/${userId}/user"],
	{ user_id?: string }
> => {
	return useSWRMutation(
		user_id ? [user_id, "/api/v1/agents/versions/${userId}/user"] : false,
		([id]) => ChatApi.getAiAssistantBotInfo({ user_id: id }),
	)
}

export default useAiAssistantBotInfo
