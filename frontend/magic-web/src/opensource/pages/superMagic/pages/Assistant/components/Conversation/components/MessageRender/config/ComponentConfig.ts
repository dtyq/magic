const ComponentConfig: Record<
	string,
	{
		componentType: string
		loader: () => Promise<any>
		getProps?: (message: any) => any
	}
> = {
	RevokeTip: {
		componentType: "RevokeTip",
		loader: () =>
			import("@/opensource/pages/chatNew/components/ChatMessageList/components/RevokeTip"),
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
