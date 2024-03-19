import { useEffect } from "react"
import type { DataService } from "@/opensource/components/business/MentionPanel/types"
import { MessageEditorStore } from "../stores"
import type { DraftKey } from "../types"

interface UseSyncEditorStoreStateParams {
	store: MessageEditorStore
	draftKey?: DraftKey | null
	mentionPanelStore?: DataService
	isSending: boolean
	isTaskRunning: boolean
}

export default function useSyncEditorStoreState({
	store,
	draftKey,
	mentionPanelStore,
	isSending,
	isTaskRunning,
}: UseSyncEditorStoreStateParams) {
	useEffect(() => {
		store.draftStore.setDraftKey(draftKey ?? null)
	}, [draftKey, store])

	useEffect(() => {
		if (!mentionPanelStore) {
			return
		}
		store.draftStore.setMentionPanelStore(mentionPanelStore)
	}, [mentionPanelStore, store])

	useEffect(() => {
		store.setIsSending(isSending)
	}, [isSending, store])

	useEffect(() => {
		store.setIsTaskRunning(isTaskRunning)
	}, [isTaskRunning, store])
}
