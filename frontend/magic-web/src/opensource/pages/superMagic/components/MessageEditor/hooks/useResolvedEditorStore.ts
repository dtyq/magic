import { useState } from "react"
import type { DataService } from "@/opensource/components/business/MentionPanel/types"
import { MessageEditorStore, useOptionalMessageEditorStore } from "../stores"

interface UseResolvedEditorStoreParams {
	mentionPanelStore?: DataService
}

export default function useResolvedEditorStore({
	mentionPanelStore,
}: UseResolvedEditorStoreParams) {
	const parentStore = useOptionalMessageEditorStore()
	const [localStore] = useState<MessageEditorStore | null>(() =>
		parentStore ? null : new MessageEditorStore({ mentionPanelStore }),
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
