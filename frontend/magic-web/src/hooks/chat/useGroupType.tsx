import { GroupConversationType } from "@/types/chat/conversation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

/**
 * 获取群聊类型
 * @returns 群聊类型
 */
const useGroupTypes = () => {
	const { t } = useTranslation("interface")

	const options = useMemo(() => {
		return {
			[GroupConversationType.Internal]: {
				label: t("chat.groupType.internal"),
				value: GroupConversationType.Internal,
			},
			[GroupConversationType.InternalMeeting]: {
				label: t("chat.groupType.internalMeeting"),
				value: GroupConversationType.InternalMeeting,
			},
			[GroupConversationType.InternalProject]: {
				label: t("chat.groupType.internalProject"),
				value: GroupConversationType.InternalProject,
			},
			[GroupConversationType.InternalTraining]: {
				label: t("chat.groupType.internalTraining"),
				value: GroupConversationType.InternalTraining,
			},
			[GroupConversationType.InternalWorkOrder]: {
				label: t("chat.groupType.internalWorkOrder"),
				value: GroupConversationType.InternalWorkOrder,
			},
			[GroupConversationType.External]: {
				label: t("chat.groupType.external"),
				value: GroupConversationType.External,
			},
		}
	}, [t])

	return options
}

export default useGroupTypes
