import { useCallback, useEffect, useMemo, useState } from "react"
import {
	RecordingSessionHistoryDB,
	type StoredSessionHistory,
} from "@/services/recordSummary/RecordingSessionHistoryDB"
import { AudioChunkDB } from "@/services/recordSummary/MediaRecorderService/AudioChunkDB"
import { userStore } from "@/models/user"

export type SessionScope = "current" | "all"

interface UseSessionHistoryResult {
	loading: boolean
	sessions: StoredSessionHistory[]
	scope: SessionScope
	setScope: (scope: SessionScope) => void
	refresh: () => Promise<void>
	removeOne: (id: string) => Promise<void>
	cleanupExpired: () => Promise<number>
}

const db = new RecordingSessionHistoryDB()
const audioChunkDB = new AudioChunkDB()

export function useSessionHistory(enabled: boolean): UseSessionHistoryResult {
	const [loading, setLoading] = useState(false)
	const [sessions, setSessions] = useState<StoredSessionHistory[]>([])
	const [scope, setScope] = useState<SessionScope>("current")

	const currentUserId = useMemo(() => userStore.user.userInfo?.user_id ?? "", [])

	const refresh = useCallback(async () => {
		setLoading(true)
		try {
			const rows =
				scope === "current" && currentUserId
					? await db.listByUser(currentUserId)
					: await db.listAll()
			setSessions(rows)
		} finally {
			setLoading(false)
		}
	}, [scope, currentUserId])

	const removeOne = useCallback(
		async (id: string) => {
			await db.deleteById(id)
			await audioChunkDB.deleteAllSessionChunks(id)
			await refresh()
		},
		[refresh],
	)

	const cleanupExpired = useCallback(async () => {
		const expiredIds = await db.cleanupExpired()
		// Remove audio chunks associated with expired sessions.
		for (const sessionId of expiredIds) {
			await audioChunkDB.deleteAllSessionChunks(sessionId)
		}
		if (expiredIds.length > 0) {
			await refresh()
		}
		return expiredIds.length
	}, [refresh])

	useEffect(() => {
		if (!enabled) return
		void refresh()
	}, [enabled, refresh])

	return {
		loading,
		sessions,
		scope,
		setScope,
		refresh,
		removeOne,
		cleanupExpired,
	}
}
