import chatDb from "@/database/chat"
import EditorDraftStore, {
	EditorDraft,
	EditorDraftWithInfo,
} from "@/stores/chatNew/editorDraft"
import { logger as Logger } from "@/utils/log"
import { cloneDeep, omit } from "lodash-es"

const logger = Logger.createLogger("DraftService")

class DraftService {
	// 持久化草稿的回调
	persistDraftCallback: number | null = null

	initDrafts() {
		chatDb
			.getEditorDraftTable()
			?.toArray()
			.then((drafts) => {
				EditorDraftStore.initDrafts(drafts)
			})
	}

	// 写入草稿
	writeDraft(conversationId: string, topicId: string, draft: EditorDraft) {
		EditorDraftStore.setDraft(conversationId, topicId, draft)
		this.persistDraft(conversationId, topicId, draft)
	}

	// 删除草稿
	deleteDraft(conversationId: string, topicId: string) {
		EditorDraftStore.deleteDraft(conversationId, topicId)
		this.persistDraft(conversationId, topicId, undefined)
	}

	// 持久化草稿
	persistDraft(conversationId: string, topicId: string, draft: EditorDraft | undefined) {
		if (this.persistDraftCallback) {
			clearTimeout(this.persistDraftCallback)
		}

		this.persistDraftCallback = requestIdleCallback(() => {
			const table = chatDb.getEditorDraftTable()

			const key = `${conversationId}-${topicId}`

			if (!draft) {
				table?.delete(key)
				return
			}

			const draftWithInfo = cloneDeep({
				key,
				topic_id: topicId,
				conversation_id: conversationId,
				content: draft.content,
				files: draft.files.map((item) => omit(item, ["error", "cancel"])),
			}) as EditorDraftWithInfo

			table?.put(draftWithInfo).catch((error) => {
				logger.error("持久化草稿失败", error, draftWithInfo)
			})

			this.persistDraftCallback = null
		})
	}
}

export default new DraftService()
