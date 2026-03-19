import { GroupConversationType } from "@/types/chat/conversation"
import i18next from "i18next"

export const groupTypeOptions = [
	{
		label: i18next.t("groupChat.internalGroup", { ns: "flow" }),
		value: GroupConversationType.Internal,
	},
	{
		label: i18next.t("groupChat.workUnitGroup", { ns: "flow" }),
		value: GroupConversationType.InternalWorkOrder,
	},
	{
		label: i18next.t("groupChat.trainingGroup", { ns: "flow" }),
		value: GroupConversationType.InternalTraining,
	},
	{
		label: i18next.t("groupChat.meetingGroup", { ns: "flow" }),
		value: GroupConversationType.InternalMeeting,
	},
	{
		label: i18next.t("groupChat.projectGroup", { ns: "flow" }),
		value: GroupConversationType.InternalProject,
	},
	{
		label: i18next.t("groupChat.externalGroup", { ns: "flow" }),
		value: GroupConversationType.External,
	},
]
