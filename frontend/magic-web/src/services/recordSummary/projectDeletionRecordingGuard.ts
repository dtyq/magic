import { userStore } from "@/models/user"
import recordingStore from "@/stores/recordingSummary"
import { RecordingPersistence } from "./RecordingPersistence"
import { DEFAULT_RECORDING_CONFIG } from "./utils/config"

export interface ProjectDeletionBlock {
	reason: "active-session" | "unresolved-other-tab"
	projectId?: string
	sessionId?: string
}

const persistence = new RecordingPersistence(DEFAULT_RECORDING_CONFIG.persistence)

export class ProjectDeletionBlockedByRecordingError extends Error {
	constructor(readonly block: ProjectDeletionBlock) {
		super("Finish the recording before deleting its project")
		this.name = "ProjectDeletionBlockedByRecordingError"
	}
}

/** Check the recording owner before navigation, optimistic removal, or a delete request. */
export function getProjectDeletionBlock(projectIds: string[]): ProjectDeletionBlock | null {
	const ids = new Set(projectIds.filter(Boolean))
	if (!ids.size) return null

	const currentUserId = userStore.user.userInfo?.user_id
	const currentOrganizationCode = userStore.user.organizationCode
	const { businessData, status, isWaitingUpload, isWaitingSummarize } = recordingStore
	const localProjectId = businessData.project?.id
	const isLocalSessionActive =
		status === "recording" || status === "paused" || isWaitingUpload || isWaitingSummarize
	if (
		currentUserId &&
		isLocalSessionActive &&
		localProjectId &&
		ids.has(localProjectId) &&
		businessData.userId === currentUserId
	) {
		return { reason: "active-session", projectId: localProjectId }
	}

	// Read existing persistence without constructing the heavy recording service.
	// It also identifies the project recorded by another tab of this browser.
	const session = persistence.loadSession()
	const belongsToCurrentUser =
		Boolean(currentUserId) &&
		session?.userId === currentUserId &&
		session?.organizationCode === currentOrganizationCode
	const hasPendingSession =
		belongsToCurrentUser && (session?.status === "recording" || session?.status === "paused")
	const persistedProjectId = hasPendingSession ? session?.project?.id : undefined
	if (persistedProjectId && ids.has(persistedProjectId)) {
		return { reason: "active-session", projectId: persistedProjectId, sessionId: session?.id }
	}

	// Never guess which project an unidentifiable lock holder is recording.
	if (recordingStore.isOtherTabRecording && !persistedProjectId) {
		return { reason: "unresolved-other-tab" }
	}
	return null
}

export function assertProjectDeletionAllowed(projectIds: string[]): void {
	const block = getProjectDeletionBlock(projectIds)
	if (block) throw new ProjectDeletionBlockedByRecordingError(block)
}
