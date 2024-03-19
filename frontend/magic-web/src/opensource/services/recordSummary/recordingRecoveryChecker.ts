import { RecordingPersistence } from "./RecordingPersistence"
import { DEFAULT_RECORDING_CONFIG } from "./utils/config"

let persistence: RecordingPersistence | null = null

function getPersistence(): RecordingPersistence {
	if (!persistence) {
		persistence = new RecordingPersistence(DEFAULT_RECORDING_CONFIG.persistence)
	}
	return persistence
}

/**
 * Lightweight recoverable-session check without loading heavy recording service.
 */
export function hasRecoverableRecordingSession(currentUserId?: string): boolean {
	try {
		const session = getPersistence().loadSession()
		if (!session) return false

		if (currentUserId && session.userId && session.userId !== currentUserId) return false

		return session.status === "recording" || session.status === "paused"
	} catch (_error) {
		return false
	}
}
