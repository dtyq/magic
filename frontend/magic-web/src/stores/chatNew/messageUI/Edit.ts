import { FullMessage } from "@/types/chat/message"
import { makeAutoObservable } from "mobx"

/**
 * 消息编辑器
 */
class MessageEditStore {
	/**
	 * 编辑消息
	 */
	editMessage: FullMessage | undefined = undefined

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 设置编辑消息
	 * @param message 消息
	 */
	setEditMessage(message: FullMessage) {
		this.editMessage = message
	}

	/**
	 * 重置编辑消息
	 */
	reset() {
		this.editMessage = undefined
	}
}

export default new MessageEditStore()
