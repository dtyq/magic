import { makeAutoObservable } from "mobx"

class MobileEditorStore {
	emojiPanelOpen = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	toggleEmojiPanel = () => {
		this.emojiPanelOpen = !this.emojiPanelOpen
	}

	closeEmojiPanel = () => {
		this.emojiPanelOpen = false
	}

	openEmojiPanel = () => {
		this.emojiPanelOpen = true
	}
}

export default new MobileEditorStore()
