import { useCallback, useEffect, useMemo, useState } from "react"
import {
	RecordingSessionHistoryDB,
	type StoredSessionHistory,
} from "@/services/recordSummary/RecordingSessionHistoryDB"
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
			await refresh()
		},
		[refresh],
	)

	const cleanupExpired = useCallback(async () => {
		const count = await db.cleanupExpired()
		if (count > 0) {
			await refresh()
		}
		return count
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
