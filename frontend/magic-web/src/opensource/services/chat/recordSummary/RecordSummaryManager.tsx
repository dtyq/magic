import type { RecordSummaryConversationMessage } from "@/opensource/types/chat/conversation_message"
import { makeObservable, observable } from "mobx"
import { Local } from "@/opensource/stores/common/Storage"
import chatDb from "@/opensource/database/chat"
import { userStore } from "@/opensource/models/user"

type MessageQueueItem = {
	message: Pick<RecordSummaryConversationMessage, "type" | "recording_summary">
	callFnName: string
	sendTime: number
}

class RecordSummaryManager {
	messageQueue: MessageQueueItem[] = []

	get isRecordingKey() {
		return `${userStore.user.userInfo?.magic_id || "default"}_isRecording`
	}

	isRecording: boolean = false

	constructor() {
		makeObservable(this, {
			isRecording: observable,
		})
		this.isRecording = JSON.parse(Local.get(this.isRecordingKey) || "false")
	}

	getMessageQueueTable() {
		return chatDb.getRecordSummaryMessageQueueTable()
	}

	updateIsRecording(bool: boolean) {
		this.isRecording = bool
		Local.set(this.isRecordingKey, bool)
	}

	addToMessageQueue(message: MessageQueueItem) {
		this.messageQueue.push(message)
		// 存到 db 中
		this.getMessageQueueTable()?.add(message)
	}
}

export default new RecordSummaryManager()
