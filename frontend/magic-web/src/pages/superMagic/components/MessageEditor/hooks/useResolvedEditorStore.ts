import { useState } from "react"
import type { DataService } from "@/components/business/MentionPanel/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { MessageEditorStore, useOptionalMessageEditorStore } from "../stores"

interface UseResolvedEditorStoreParams {
	mentionPanelStore?: DataService
	projectFilesStore?: ProjectFilesStore
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
}

export default function useResolvedEditorStore({
	mentionPanelStore,
	projectFilesStore,
	topicModelStore,
}: UseResolvedEditorStoreParams) {
	const parentStore = useOptionalMessageEditorStore()
	const [localStore] = useState<MessageEditorStore | null>(() =>
		parentStore
			? null
			: new MessageEditorStore({
					mentionPanelStore,
					projectFilesStore,
					topicModelStore,
				}),
	)
	const store = parentStore ?? localStore

	if (!store) {
		throw new Error("MessageEditorStore initialization failed")
	}

	return {
		store,
		parentStore,
	}
}
