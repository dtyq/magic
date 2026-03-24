import { makeAutoObservable } from "mobx"

type MenuTriggerType = "click" | "contextMenu"

class ChatMenuStore {
	currentConversationId: string | null = null

	/** 用于 getElementById 定位菜单的 DOM 元素 id，避免 Message / AiBots 列表同 conversationId 重复 */
	menuElementId: string | null = null

	triggerType: MenuTriggerType = "click"

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	openMenu(conversationId: string, triggerType: MenuTriggerType = "click", elementId?: string) {
		this.currentConversationId = conversationId
		this.menuElementId = elementId ?? conversationId
		this.triggerType = triggerType
	}

	closeMenu() {
		this.currentConversationId = null
		this.menuElementId = null
	}

	get isOpen() {
		return this.currentConversationId !== null
	}
}

const chatMenuStore = new ChatMenuStore()

export default chatMenuStore
