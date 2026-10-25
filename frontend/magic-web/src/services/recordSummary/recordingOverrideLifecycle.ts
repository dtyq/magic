import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { isOverrideSummaryAlreadySettled } from "./RecordingErrorManager"

export type RecordingOverrideSource = "currentTab" | "otherTab" | "history"
export type RecordingOverrideStatus = "recording" | "paused"

export interface RecordingOverrideStartContext {
	workspace: Workspace | null
	project: ProjectListItem | null
	topic: Topic | null
	model: ModelItem | null
}

export interface RecordingOverrideContext {
	sessionId?: string
	duration: string
	source: RecordingOverrideSource
	status: RecordingOverrideStatus
	/** Snapshot captured before completion clears the shared recording store. */
	startContext?: RecordingOverrideStartContext
}

export type ForceOverrideRetryChoice = "retry" | "continue" | "cancel"

export interface ForceOverrideFinalizationSteps {
	stopRecordingServices: () => void | Promise<void>
	flushSessionUploads: () => void | Promise<void>
	summarizeSession: () => void | Promise<void>
	completeSession: () => void | Promise<void>
}

export interface ForceOverrideFlowSteps {
	confirm: () => boolean | Promise<boolean>
	confirmRetry: () => ForceOverrideRetryChoice | Promise<ForceOverrideRetryChoice>
	prepare: () => boolean | Promise<boolean>
	forceRelease?: () => boolean | void | Promise<boolean | void>
}

/**
 * A recording session is not completed until its final audio upload, batch-save,
 * and summary operations have settled successfully.
 */
export async function runForceOverrideFinalization(
	steps: ForceOverrideFinalizationSteps,
): Promise<void> {
	await steps.stopRecordingServices()
	await steps.flushSessionUploads()
	await runOverrideSummarizeStep(steps.summarizeSession)
	await steps.completeSession()
}

/** Treat summarizing/completed API codes as a finished previous recording. */
export async function runOverrideSummarizeStep(
	summarizeSession: () => void | Promise<void>,
): Promise<void> {
	try {
		await summarizeSession()
	} catch (error) {
		if (!isOverrideSummaryAlreadySettled(error)) throw error
	}
}

/** Confirm, retry, or force-release the old session before a new recording. */
export async function runForceOverrideFlow(steps: ForceOverrideFlowSteps): Promise<boolean> {
	if (!(await steps.confirm())) return false

	const shouldRetry = true
	while (shouldRetry) {
		let prepared = false
		try {
			prepared = await steps.prepare()
		} catch {
			prepared = false
		}
		if (prepared) return true

		const choice = await steps.confirmRetry()
		if (choice === "retry") continue
		if (choice === "cancel") return false
		const released = await steps.forceRelease?.()
		return released !== false
	}

	return false
}
