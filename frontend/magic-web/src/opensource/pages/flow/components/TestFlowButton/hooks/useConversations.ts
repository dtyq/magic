import { contactStore } from "@/opensource/stores/contact"
import { useMemo } from "react"
import magicIconLogo from "@/assets/logos/magic-icon.svg"
import { getUserName } from "@/utils/modules/chat"
import { useOrganization } from "@/opensource/models/user/hooks"
import conversationStore from "@/opensource/stores/chatNew/conversation"

export default function useConversations() {
	const userInfos = contactStore.userInfos
	const { conversations } = conversationStore
	const { organizationCode } = useOrganization()

	const conversationInThisOrganization = useMemo(
		() =>
			Object.entries(conversations ?? [])
				.filter((item) => {
					return organizationCode ? item[0].startsWith(organizationCode) : false
				})
				.map((item) => item[1]),
		[conversations, organizationCode],
	)

	const conversationList = useMemo(() => {
		return (
			conversationInThisOrganization?.map((value) => {
				const { receive_id, id } = value
				const userInfo = userInfos.get(receive_id)

				return {
					value: id,
					avatar: userInfo?.avatar_url ?? {
						src: magicIconLogo,
						style: {
							background: "#ababab70",
						},
					},
					label: getUserName(userInfo),
				}
			}) ?? []
		)
	}, [conversationInThisOrganization, userInfos])

	return {
		conversationList,
	}
}
