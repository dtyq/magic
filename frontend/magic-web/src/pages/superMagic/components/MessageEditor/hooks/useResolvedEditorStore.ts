import { useState } from "react"
import type { DataService } from "@/components/business/MentionPanel/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { MessageEditorStore, useOptionalMessageEditorStore } from "../stores"

interface UseResolvedEditorStoreParams {
	mentionPanelStore?: DataService
	projectFilesStore?: ProjectFilesStore
}

export default function useResolvedEditorStore({
	mentionPanelStore,
	projectFilesStore,
}: UseResolvedEditorStoreParams) {
	const parentStore = useOptionalMessageEditorStore()
	const [localStore] = useState<MessageEditorStore | null>(() =>
		parentStore ? null : new MessageEditorStore({ mentionPanelStore, projectFilesStore }),
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
