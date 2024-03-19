import MessageDropdownStore from "@/opensource/stores/chatNew/messageUI/Dropdown"
import MessageStore from "@/opensource/stores/chatNew/message"
import ConversationStore from "@/opensource/stores/chatNew/conversation"

import { MessageContextMenuKey } from "@/opensource/stores/chatNew/messageUI/const"
import {
	IconArrowBackUp,
	IconCopy,
	IconMessageCircle2,
	IconPencil,
	IconTrash,
} from "@tabler/icons-react"
import { SendStatus, ConversationMessageType } from "@/opensource/types/chat/conversation_message"
import type { MenuItem } from "@/opensource/stores/chatNew/messageUI/const"
import { CONVERSATION_MESSAGE_CAN_REVOKE_TYPES } from "@/opensource/constants/chat"
import clickFunctions from "./clickFunctions"
import { canCopy, canEdit, canReply } from "./utils"
import { isDebug } from "@/opensource/utils/debug"

const Items = {
	[MessageContextMenuKey.Copy]: {
		icon: {
			color: "currentColor",
			component: IconCopy,
			size: 20,
		},
		label: "chat.copy",
		key: MessageContextMenuKey.Copy,
	},
	[MessageContextMenuKey.Reply]: {
		icon: {
			color: "currentColor",
			component: IconMessageCircle2,
			size: 20,
		},
		label: "chat.reply",
		key: MessageContextMenuKey.Reply,
	},
	[MessageContextMenuKey.Revoke]: {
		icon: {
			color: "currentColor",
			component: IconArrowBackUp,
			size: 20,
		},
		label: "chat.recall",
		key: MessageContextMenuKey.Revoke,
	},
	[MessageContextMenuKey.Remove]: {
		icon: {
			color: "currentColor",
			component: IconTrash,
			size: 20,
		},
		danger: true,
		label: "chat.delete",
		key: MessageContextMenuKey.Remove,
	},
	[MessageContextMenuKey.Edit]: {
		icon: {
			color: "currentColor",
			component: IconPencil,
			size: 20,
		},
		label: "chat.edit",
		key: MessageContextMenuKey.Edit,
	},
	[MessageContextMenuKey.CopyMessageId]: {
		icon: {
			color: "currentColor",
			component: IconCopy,
			size: 20,
		},
		label: "chat.copyMessageId",
		key: MessageContextMenuKey.CopyMessageId,
	},
}

const Divider = {
	key: "divider-1",
	type: "divider",
}

class MessageDropdownService {
	/**
	 * 点击菜单时事件目标
	 */
	eventTarget: EventTarget | null = null

	/**
	 * 重置菜单
	 */
	resetMenu() {
		MessageDropdownStore.setMenu([])
	}

	/**
	 * 设置菜单
	 * @param messageId 消息ID
	 * @param e 事件
	 */
	setMenu(messageId: string, e?: EventTarget): void {
		this.eventTarget = e ?? null
		const message = MessageStore.getMessage(messageId)
		const isAiConversation = ConversationStore.currentConversation?.isAiConversation

		if (!message) return
		MessageDropdownStore.setCurrentMessageId(messageId)
		MessageDropdownStore.setCurrentMessage(message)
		const isSelf = message.is_self
		const inPending = MessageStore.getMessageSendStatus(messageId) === SendStatus.Pending

		const menu: MenuItem[] = []

		if (inPending) {
			menu.push(Items[MessageContextMenuKey.Copy])
		} else {
			if (canCopy(message.type)) {
				menu.push(Items[MessageContextMenuKey.Copy])
			}

			if (canReply(message.type)) {
				menu.push(Items[MessageContextMenuKey.Reply])
			}

			/**
			 * 非AI对话可以编辑消息
			 */
			if (!isAiConversation && isSelf && canEdit(message.type)) {
				menu.push(Items[MessageContextMenuKey.Edit])
			}

			if (
				isSelf &&
				CONVERSATION_MESSAGE_CAN_REVOKE_TYPES.includes(
					message.type as ConversationMessageType,
				)
			) {
				if (menu.length > 0) menu.push(Divider)
				menu.push(Items[MessageContextMenuKey.Revoke])
			}

			if (isDebug()) {
				menu.push(Items[MessageContextMenuKey.CopyMessageId])
			}

			menu.push(Items[MessageContextMenuKey.Remove])
		}

		MessageDropdownStore.setMenu(menu)
	}

	/**
	 * 点击菜单项
	 * @param key 菜单项
	 */
	clickMenuItem(key: MessageContextMenuKey) {
		if (clickFunctions[key]) {
			clickFunctions[key]?.(MessageDropdownStore.currentMessageId || "", this.eventTarget)
		} else {
			console.error(`clickMenuItem: ${key} 没有对应的点击函数`)
		}
	}
}

export default new MessageDropdownService()
