import Conversation from "@/opensource/models/chat/conversation"
import { makeAutoObservable } from "mobx"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { ActionSheetProps } from "antd-mobile"
import { Flex } from "antd"
import MagicIcon, { MagicIconProps } from "@/opensource/components/base/MagicIcon"
import { IconMessage2Cancel, IconMessage2X, IconPin, IconPinned } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

export const enum Action {
	Pin = "pin",
	Unpin = "unpin",
	MoveToGroup = "moveToGroup",
	Delete = "delete",
	Unmute = "unmute",
	Mute = "mute",
	Unfollow = "unfollow",
	Follow = "follow",
}

const MenuItem = ({ i18nText, icon }: { i18nText: string; icon: MagicIconProps["component"] }) => {
	const { t } = useTranslation("interface")
	return (
		<Flex align="center" gap={4}>
			<MagicIcon component={icon} size={20} color="currentColor" />
			{t(i18nText)}
		</Flex>
	)
}

class ConversationMenuStore {
	conversationId = ""
	conversation: Conversation | null = null
	actions: ActionSheetProps["actions"] = []

	constructor() {
		makeAutoObservable(this)
	}

	open = false

	get receiveType() {
		return ConversationStore.getConversation(this.conversationId)?.receive_type
	}

	get receiveId() {
		return ConversationStore.getConversation(this.conversationId)?.receive_id
	}

	openMenu = (conversationId: string) => {
		this.conversationId = conversationId
		const conversation = ConversationStore.getConversation(conversationId)
		if (conversation) {
			this.setMenu(conversation)
			this.open = true
		}
	}

	setMenu = (conversation: Conversation) => {
		this.conversation = conversation

		const actions: ActionSheetProps["actions"] = []

		// Pin/Unpin conversation
		if (conversation.is_top === 1) {
			actions.push({
				key: Action.Unpin,
				text: (
					<MenuItem i18nText="chat.floatButton.cancelTopConversation" icon={IconPinned} />
				),
			})
		} else {
			actions.push({
				key: Action.Pin,
				text: <MenuItem i18nText="chat.floatButton.topConversation" icon={IconPin} />,
			})
		}

		// Mute/Unmute notifications
		if (conversation.is_not_disturb === 1) {
			actions.push({
				key: Action.Unmute,
				text: (
					<MenuItem
						i18nText="chat.floatButton.disableNoDisturbing"
						icon={IconMessage2Cancel}
					/>
				),
			})
		} else {
			actions.push({
				key: Action.Mute,
				text: (
					<MenuItem
						i18nText="chat.floatButton.enableNoDisturbing"
						icon={IconMessage2Cancel}
					/>
				),
			})
		}

		// // Follow/Unfollow functionality (commented out in original)
		// if (conversation.is_mark === 1) {
		// 	actions.push({
		// 		key: Action.Unfollow,
		// 		text: <MenuItem text={texts.unfollow} icon={IconMessage2Cancel} />,
		// 	})
		// } else {
		// 	actions.push({
		// 		key: Action.Follow,
		// 		text: <MenuItem text={texts.follow} icon={IconMessage2Cancel} />,
		// 	})
		// }

		// // Move to group (commented out in original)
		// actions.push({
		// 	key: Action.MoveToGroup,
		// 	text: <MenuItem text={texts.moveToGroup} icon={IconMessage2Cancel} />,
		// })

		// Delete conversation
		actions.push({
			key: Action.Delete,
			text: <MenuItem i18nText="chat.floatButton.removeGroup" icon={IconMessage2X} />,
			danger: true,
		})

		this.actions = actions
	}

	closeMenu = () => {
		this.open = false
	}
}

export default new ConversationMenuStore()
