import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import type { SeqResponse } from "@/types/request"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import userFilesStore, { type UserFileChangeInput } from "@/stores/userFiles"

const MAX_SEEN_EVENTS = 256
const CHANGE_DEBOUNCE_MS = 80

/** Keeps the shared UserSpace tree aligned with user-space file events. */
export function useUserFilesChangeRealtime(enabled = true): void {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingParentsRef = useRef<Set<string>>(new Set())
	const seenKeysRef = useRef<string[]>([])
	const flush = useMemoizedFn(async () => {
		const parents = [...pendingParentsRef.current]
		pendingParentsRef.current.clear()
		const targets = parents.filter((parentId) => userFilesStore.getDirectory(parentId).loaded)
		if (!targets.length) targets.push("root")
		await Promise.all(
			targets.map((parentId) =>
				userFilesStore.loadDirectory(parentId === "root" ? undefined : parentId, true),
			),
		)
	})

	useEffect(() => {
		if (!enabled) return undefined
		const pendingParents = pendingParentsRef.current
		const schedule = () => {
			if (timerRef.current) clearTimeout(timerRef.current)
			timerRef.current = setTimeout(() => {
				timerRef.current = null
				void flush().catch(() => undefined)
			}, CHANGE_DEBOUNCE_MS)
		}
		const handle = (seq: SeqResponse<SuperMagicFileChangeMessage>) => {
			const message = seq?.message
			if (!message || message.space_type !== "user") return
			const key = String(seq.seq_id || seq.message_id || message.timestamp || "")
			if (key && seenKeysRef.current.includes(key)) return
			if (key) {
				seenKeysRef.current.push(key)
				if (seenKeysRef.current.length > MAX_SEEN_EVENTS) seenKeysRef.current.shift()
			}
			const result = userFilesStore.applyUserFileChanges(
				(message.changes ?? []) as UserFileChangeInput[],
				(message.refresh_parent_ids ?? []).map(String),
			)
			result.refreshParentIds.forEach((id) => pendingParentsRef.current.add(id))
			schedule()
		}
		const recover = () => {
			if (document.hidden || !navigator.onLine) return
			pendingParentsRef.current.add("root")
			schedule()
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_File_Change_Intermediate, handle)
		document.addEventListener("visibilitychange", recover)
		window.addEventListener("pageshow", recover)
		window.addEventListener("online", recover)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_File_Change_Intermediate, handle)
			document.removeEventListener("visibilitychange", recover)
			window.removeEventListener("pageshow", recover)
			window.removeEventListener("online", recover)
			if (timerRef.current) clearTimeout(timerRef.current)
			timerRef.current = null
			pendingParents.clear()
			seenKeysRef.current = []
		}
	}, [enabled, flush])
}
