import { makeAutoObservable } from "mobx"

type MenuTriggerType = "click" | "contextMenu"

class ChatMenuStore {
	currentConversationId: string | null = null

	triggerType: MenuTriggerType = "click"

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	openMenu(conversationId: string, triggerType: MenuTriggerType = "click") {
		this.currentConversationId = conversationId
		this.triggerType = triggerType
	}

	closeMenu() {
		this.currentConversationId = null
	}

	get isOpen() {
		return this.currentConversationId !== null
	}
}

const chatMenuStore = new ChatMenuStore()

export default chatMenuStore
