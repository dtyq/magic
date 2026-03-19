// 消息编辑草稿
import { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { JSONContent } from "@tiptap/core"
import { makeAutoObservable } from "mobx"

export interface EditorDraftWithInfo {
	key: string
	topic_id: string
	conversation_id: string
	content: JSONContent | undefined
	files: Omit<FileData, "error" | "cancel">[]
}

export type EditorDraft = Omit<EditorDraftWithInfo, "key" | "conversation_id" | "topic_id">

class EditorDraftStore {
	draftMap = new Map<string, EditorDraft>()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	initDrafts(drafts: EditorDraftWithInfo[]) {
		this.draftMap.clear()
		drafts.forEach((draft) => this.draftMap.set(draft.key, draft))
	}

	hasDraft(conversationId: string, topicId: string) {
		return this.draftMap.has(`${conversationId}-${topicId}`)
	}

	// 获取草稿
	getDraft(conversationId: string, topicId: string) {
		return this.draftMap.get(`${conversationId}-${topicId}`)
	}

	// 设置草稿
	setDraft(conversationId: string, topicId: string, draft: EditorDraft) {
		this.draftMap.set(`${conversationId}-${topicId}`, draft)
	}

	// 删除草稿
	deleteDraft(conversationId: string, topicId: string) {
		this.draftMap.delete(`${conversationId}-${topicId}`)
	}

	// 获取所有草稿
	getAllDrafts() {
		return Array.from(this.draftMap.entries())
	}
}

export default new EditorDraftStore()
