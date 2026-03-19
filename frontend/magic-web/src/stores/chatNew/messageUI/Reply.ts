import { makeAutoObservable } from "mobx"
import type { FullMessage } from "@/types/chat/message"

class ReplyStore {
	/**
	 * 回复消息ID
	 */
	replyMessageId: string | undefined = undefined

	/**
	 * 回复消息
	 */
	replyMessage: FullMessage | undefined = undefined

	/**
	 * 回复消息文件
	 */
	replyFile:
		| {
			fileId: string | undefined
			referText: string | undefined
		}
		| undefined = undefined

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 设置回复消息
	 * @param messageId 消息ID
	 * @param message 消息
	 */
	setReplyMessage(messageId: string, message: FullMessage) {
		this.replyMessageId = messageId
		this.replyMessage = message
		console.log("setReplyMessage", this.replyMessageId, this.replyMessage)
	}

	/**
	 * 重置回复消息
	 */
	resetReplyMessage() {
		this.replyMessageId = undefined
		this.replyMessage = undefined
	}

	/**
	 * 设置回复消息文件
	 * @param fileId 文件ID
	 * @param referText 引用文本
	 */
	setReplyFile(fileId: string, referText: string) {
		this.replyFile = {
			fileId,
			referText,
		}
	}

	/**
	 * 重置回复消息文件
	 */
	resetReplyFile() {
		this.replyFile = undefined
	}
}

export default new ReplyStore()
