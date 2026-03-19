import { makeAutoObservable } from "mobx"
import type { FullMessage } from "@/types/chat/message"
import type { MenuItem } from "./const"

class MessageDropdownStore {
	menu: MenuItem[] = []

	currentMessageId: string | undefined = undefined

	currentMessage: FullMessage | undefined = undefined

	constructor() {
		makeAutoObservable(this)
	}

	setMenu(menu: MenuItem[]) {
		this.menu = menu
	}

	setCurrentMessageId(currentMessageId: string | undefined) {
		this.currentMessageId = currentMessageId
	}

	setCurrentMessage(currentMessage: FullMessage | undefined) {
		this.currentMessage = currentMessage
	}
}

export default new MessageDropdownStore()
