import type Conversation from "@/opensource/models/chat/conversation"
import dayjs from "@/opensource/lib/dayjs"
import { sortBy } from "lodash-es"
import { useCallback } from "react"
import { getUserName } from "@/opensource/utils/modules/chat"
import { MessageReceiveType } from "@/opensource/types/chat"
import { useTranslation } from "react-i18next"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import ConversationSiderbarStore from "@/opensource/stores/chatNew/conversationSidebar"
import groupInfoStore from "@/opensource/stores/groupInfo"
import userInfoStore from "@/opensource/stores/userInfo"
import { Group, NodeType, OperationTypes, User } from "@dtyq/user-selector"
// 默认权限
export const defaultOperation = OperationTypes.Edit

export default function useContacts() {
	const { t } = useTranslation()
	const { conversations } = conversationStore

	// 群组数据源
	const genGroupListData = useCallback(
		(cs: Conversation[]) => {
			const list = cs?.reduce((acc, value) => {
				const { receive_id } = value
				const groupInfo = groupInfoStore.get(receive_id)

				if (groupInfo) {
					const targetInfo = {
						id: groupInfo.id,
						icon: groupInfo?.group_avatar,
						name: groupInfo?.group_name,
						description: t("common.groupChat", { ns: "flow" }),
						time: value.last_receive_message?.time,
					}
					acc.push({
						...groupInfo,
						id: groupInfo.id,
						dataType: NodeType.Group,
						operation: defaultOperation,
						name: groupInfo?.group_name,
						avatar_url: groupInfo?.group_avatar,
						time: value.last_receive_message?.time,
						target_info: targetInfo,
					})
				}
				return acc
			}, [] as Group[])

			return sortBy(list, (item) => -dayjs(item?.target_info?.time).diff())
		},
		[t],
	)

	// 用户数据源
	const genUserListData = useCallback(
		(cs?: Conversation[]) => {
			return sortBy(
				cs
					?.filter((value) => value.receive_type === MessageReceiveType.User)
					.map((value) => {
						const { receive_id } = value
						const userInfo = userInfoStore.get(receive_id)
						return {
							...userInfo,
							id: receive_id,
							dataType: NodeType.User,
							operation: defaultOperation,
							name: getUserName(userInfo),
							time: value.last_receive_message?.time,
						} as User
					}) ?? [],
				(item) => -dayjs(item.time!).diff(),
			)
		},
		[t],
	)

	return {
		users: genUserListData(
			ConversationSiderbarStore.conversationSiderbarGroups.user
				.map((id) => conversations[id])
				.filter(Boolean),
		),
		groups: genGroupListData(
			ConversationSiderbarStore.conversationSiderbarGroups.group
				.map((id) => conversations[id])
				.filter(Boolean),
		),
	}
}
