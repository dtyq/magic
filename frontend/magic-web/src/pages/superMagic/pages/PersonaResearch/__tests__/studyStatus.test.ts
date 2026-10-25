import { describe, expect, it } from "vitest"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { resolveStudyStatus } from "../services/studyStatus"
import type { StudyFile } from "../types"

const study = (phase: StudyFile["phase"], done: number): StudyFile => ({
	schema_version: 1,
	title: "t",
	question: "q",
	phase,
	phases: (
		["clarify", "plan", "desk_research", "interview", "report", "validation"] as const
	).map((key, index) => ({
		key,
		status: index < done ? "done" : index === done ? "running" : "pending",
	})),
})

describe("resolveStudyStatus", () => {
	it("prefers waiting-for-user over the study file", () => {
		const status = resolveStudyStatus(
			{ task_status: TaskStatus.WAITING_FOR_USER },
			study("plan", 1),
		)
		expect(status).toEqual({ kind: "waiting_user", completed: 1, total: 6 })
	})

	it("reports running with completed phases", () => {
		expect(
			resolveStudyStatus({ task_status: TaskStatus.RUNNING }, study("interview", 3)).kind,
		).toBe("running")
	})

	it("treats a finished study as fully complete", () => {
		const status = resolveStudyStatus({ task_status: TaskStatus.FINISHED }, study("done", 6))
		expect(status).toEqual({ kind: "done", completed: 6, total: 6 })
	})

	it("shows a finished topic without a study file as a plain conversation", () => {
		expect(resolveStudyStatus({ task_status: TaskStatus.FINISHED }, null)).toEqual({
			kind: "conversation",
			completed: 0,
			total: 6,
		})
	})

	it("keeps a running topic without a study file looking like a study starting", () => {
		expect(resolveStudyStatus({ task_status: TaskStatus.RUNNING }, null).kind).toBe("running")
	})

	it("falls back to idle or failed without a study file", () => {
		expect(resolveStudyStatus({ task_status: TaskStatus.SUSPENDED }, null).kind).toBe("idle")
		expect(resolveStudyStatus({ task_status: TaskStatus.ERROR }, null).kind).toBe("failed")
		expect(resolveStudyStatus(null, null)).toEqual({ kind: "idle", completed: 0, total: 6 })
	})
})
