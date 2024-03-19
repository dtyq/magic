import {
	ControlEventMessageType,
	GroupAddMemberMessage,
	GroupCreateMessage,
	GroupUsersRemoveMessage,
	GroupUpdateMessage,
	GroupDisbandMessage,
} from "@/opensource/types/chat/control_message"

const ComponentConfig: Record<
	string,
	{
		componentType: string
		loader: () => Promise<any>
		getProps?: (message: any) => any
	}
> = {
	[ControlEventMessageType.GroupAddMember]: {
		componentType: "InviteMemberTip",
		loader: () => import("../components/InviteMemberTip"),
		getProps: (message: any) => {
			return { content: message.message as GroupAddMemberMessage }
		},
	},
	[ControlEventMessageType.GroupCreate]: {
		componentType: "GroupCreateTip",
		loader: () => import("../components/GroupCreateTip"),
		getProps: (message: any) => {
			return { content: message.message as GroupCreateMessage }
		},
	},
	[ControlEventMessageType.GroupUsersRemove]: {
		componentType: "GroupUsersRemoveTip",
		loader: () => import("../components/GroupUsersRemoveTip"),
		getProps: (message: any) => {
			return { content: message.message as GroupUsersRemoveMessage }
		},
	},
	[ControlEventMessageType.GroupUpdate]: {
		componentType: "GroupUpdateTip",
		loader: () => import("../components/GroupUpdateTip"),
		getProps: (message: any) => {
			return { content: message.message as GroupUpdateMessage }
		},
	},
	[ControlEventMessageType.GroupDisband]: {
		componentType: "GroupDisbandTip",
		loader: () => import("../components/GroupDisbandTip"),
		getProps: (message: any) => {
			return { content: message.message as GroupDisbandMessage }
		},
	},
	RevokeTip: {
		componentType: "RevokeTip",
		loader: () => import("../../RevokeTip"),
		getProps: (message: any) => {
			return {
				senderUid: message.sender_id,
			}
		},
	},
	default: {
		componentType: "MessageItem",
		loader: () => import("../../MessageItem"),
		getProps: (message: any) => {
			return {
				message_id: message.message_id,
				sender_id: message.sender_id,
				name: message.name,
				avatar: message.avatar,
				is_self: message.is_self ?? false,
				message: message.message,
				unread_count: message.unread_count,
				refer_message_id: message.refer_message_id,
				edit_message_options: message.edit_message_options,
			}
		},
	},
}

export default ComponentConfig
