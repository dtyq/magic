export interface TaskEndCleanupActions {
	/** Stop the active recorder and transcription resources. */
	stopRecordingServices: () => void | Promise<void>
	/** Stop future uploads without deleting persisted audio chunks. */
	stopSessionUploads: () => void | Promise<void>
	/** Stop timers and release browser/tab resources. */
	stopStatusReporter: () => void | Promise<void>
	stopRecordStatusChecker: () => void | Promise<void>
	releaseWakeLock: () => void | Promise<void>
	removeVisibilityChangeListener: () => void | Promise<void>
	removeBeforeUnloadListener: () => void | Promise<void>
	releaseRecordingLock: () => void | Promise<void>
	/** Persist server-terminal session metadata and optional diagnostics. */
	preserveSession: () => void | Promise<void>
	/** Reset visible/runtime state even when persistence or diagnostics fail. */
	resetStore: () => void | Promise<void>
	reportError?: (stage: string, error: unknown) => void
}

/**
 * Completes local cleanup after the server has ended a recording task.
 *
 * Persistence is best-effort: local UI/runtime cleanup is the invariant that
 * must still run when IndexedDB or localStorage is unavailable.
 */
export async function runTaskEndCleanup(actions: TaskEndCleanupActions): Promise<void> {
	const reportError = (stage: string, error: unknown) => {
		try {
			actions.reportError?.(stage, error)
		} catch {
			// Diagnostics must never prevent the remaining cleanup steps.
		}
	}

	const runStep = async (stage: string, step: () => void | Promise<void>) => {
		try {
			await step()
		} catch (error) {
			reportError(stage, error)
		}
	}

	await runStep("stop_recording_services", actions.stopRecordingServices)
	await runStep("stop_session_uploads", actions.stopSessionUploads)
	await runStep("stop_status_reporter", actions.stopStatusReporter)
	await runStep("stop_record_status_checker", actions.stopRecordStatusChecker)
	await runStep("release_wake_lock", actions.releaseWakeLock)
	await runStep("remove_visibility_listener", actions.removeVisibilityChangeListener)
	await runStep("remove_before_unload_listener", actions.removeBeforeUnloadListener)
	await runStep("release_recording_lock", actions.releaseRecordingLock)
	await runStep("preserve_session", actions.preserveSession)
	await runStep("reset_store", actions.resetStore)
}
