import { MessageReceiveType } from "@/types/chat"
import Conversation from "@/models/chat/conversation"
import { formatRelativeTime } from "@/utils/string"
import { getUserName } from "@/utils/modules/chat"
import UserInfoStore from "@/stores/userInfo"
import GroupInfoStore from "@/stores/groupInfo"
import LastMessageRender from "../chatNew/components/ChatSubSider/components/LastMessageRender"

/**
 * 格式化聊天列表
 * @param conversations 聊天列表
 * @param lang 语言
 * @returns 格式化后的聊天列表
 */
export const formatChatItemList = (conversations: Conversation[], lang: string) => {
	return conversations
		.sort((a, b) => {
			if (a.last_receive_message?.time && b.last_receive_message?.time) {
				return b.last_receive_message?.time - a.last_receive_message?.time
			}
			if (a.last_receive_message?.time) {
				return -1
			}
			if (b.last_receive_message?.time) {
				return 1
			}
			return 0
		})
		.map((conversation) => {
			let name = conversation.receive_id
			let avatar = ""
			if (
				conversation.receive_type === MessageReceiveType.Ai ||
				conversation.receive_type === MessageReceiveType.User
			) {
				const userInfo = UserInfoStore.get(conversation.receive_id)
				if (userInfo) {
					name = getUserName(userInfo)
					avatar = userInfo.avatar_url
				}
			} else if (conversation.receive_type === MessageReceiveType.Group) {
				const groupInfo = GroupInfoStore.get(conversation.receive_id)
				if (groupInfo) {
					name = groupInfo.group_name
				}
			}
			return {
				id: conversation.id,
				name: name,
				avatar: avatar,
				message: <LastMessageRender message={conversation.last_receive_message} />,
				time: formatRelativeTime(lang)(conversation.last_receive_message?.time),
				unreadCount: conversation.unread_dots,
			}
		})
}
