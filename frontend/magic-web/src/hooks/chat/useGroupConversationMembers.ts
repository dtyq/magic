import type { GroupConversationMember } from "@/types/chat/conversation"
import { fetchPaddingData } from "@/utils/request"
import type { SWRResponse } from "swr"
import useSWRImmutable from "swr/immutable"
import { ChatApi } from "@/apis"

/**
 * 获取群聊成员
 * @param group_id 群ID
 * @returns
 */
const useGroupConversationMembers = (group_id?: string): SWRResponse<GroupConversationMember[]> => {
	return useSWRImmutable(
		group_id ? [group_id, `${"/api/v1/contact/groups/${id}/members"}/${group_id}`] : false,
		([groupId]) =>
			fetchPaddingData<GroupConversationMember>((params) =>
				ChatApi.getGroupConversationMembers({
					group_id: groupId,
					...params,
				}),
			).then((data) => {
				return data.sort((a, b) => {
					if (a.user_role === b.user_role) {
						return a.created_at - b.created_at
					}
					return a.user_role - b.user_role
				})
			}),
	)
}

export default useGroupConversationMembers
