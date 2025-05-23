import type Conversation from "@/opensource/models/chat/conversation"
import magicIconLogo from "@/assets/logos/magic-icon.svg"
import dayjs from "dayjs"
import { sort } from "radash"
import { useCallback } from "react"
import { getUserName } from "@/utils/modules/chat"
import { MessageReceiveType } from "@/types/chat"
import { useTranslation } from "react-i18next"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { TargetTypes, type AuthMember } from "../../../types"
import { defaultOperation } from "../../../constants"
import ConversationSiderbarStore from "@/opensource/stores/chatNew/conversationSidebar"
import groupInfoStore from "@/opensource/stores/groupInfo"
import userInfoStore from "@/opensource/stores/userInfo"

export default function useContacts() {
	const { t } = useTranslation()
	const { conversations } = conversationStore

	const genGroupListData = useCallback(
		(cs: Conversation[]) => {
			const list = cs?.reduce((acc, value) => {
				const { receive_id } = value
				const groupInfo = groupInfoStore.get(receive_id)

				if (groupInfo) {
					acc.push({
						target_id: groupInfo.id,
						target_type: TargetTypes.Group,
						operation: defaultOperation,
						target_info: {
							id: groupInfo.id,
							icon: groupInfo?.group_avatar,
							name: groupInfo?.group_name,
							description: t("common.groupChat", { ns: "flow" }),
							time: value.last_receive_message?.time,
						},
					})
				}
				return acc
			}, [] as AuthMember[])

			return sort(list, (item) => -dayjs(item?.target_info?.time).diff())
		},
		[t],
	)

	const genUserListData = useCallback(
		(cs?: Conversation[]) => {
			return sort(
				cs
					?.filter((value) => value.receive_type === MessageReceiveType.User)
					.map((value) => {
						const { receive_id } = value
						const userInfo = userInfoStore.get(receive_id)
						return {
							target_id: receive_id,
							target_type: TargetTypes.User,
							operation: defaultOperation,
							target_info: {
								id: receive_id,
								icon: userInfo?.avatar_url || {
									src: magicIconLogo,
									style: {
										background: "#ababab70",
									},
								},
								name: getUserName(userInfo),
								description: userInfo?.job_title || "",
								time: value.last_receive_message?.time,
								department: userInfo?.path_nodes?.[0]?.department_name,
							},
						}
					}) ?? [],
				(item) => -dayjs(item.target_info.time!).diff(),
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
