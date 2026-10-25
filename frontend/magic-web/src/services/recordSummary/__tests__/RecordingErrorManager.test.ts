import { describe, expect, it } from "vitest"
import {
	createTaskEndError,
	isOverrideSummaryAlreadySettled,
	RecordingErrorManager,
} from "../RecordingErrorManager"

describe("RecordingErrorManager", () => {
	it.each([51200, "51200", { code: "51200" }])("recognizes project deletion codes %j", (code) => {
		const error = typeof code === "object" ? { response: { data: code } } : { code }
		expect(new RecordingErrorManager().isTaskEndError(error)).toBe(true)
	})
	it("recognizes task-end errors when the backend serializes the code", () => {
		const error = Object.assign(new Error("task already completed"), {
			code: "43200",
			sessionId: "session-1",
		})

		expect(new RecordingErrorManager().isTaskEndError(error)).toBe(true)
	})

	it("does not classify malformed codes as task-end errors", () => {
		const error = Object.assign(new Error("invalid code"), { code: "43200x" })

		expect(new RecordingErrorManager().isTaskEndError(error)).toBe(false)
	})

	it("normalizes serialized task-end codes when creating errors", () => {
		expect(createTaskEndError("session-1", "43200").code).toBe(43200)
	})

	it("treats summarizing and completed summary codes as already settled", () => {
		expect(isOverrideSummaryAlreadySettled({ code: 43200 })).toBe(true)
		expect(isOverrideSummaryAlreadySettled({ code: "43202" })).toBe(true)
		expect(
			isOverrideSummaryAlreadySettled(
				Object.assign(new Error("already summarizing"), {
					response: { code: 43202 },
				}),
			),
		).toBe(true)
	})

	it("does not treat network or unrelated codes as a settled summary", () => {
		expect(isOverrideSummaryAlreadySettled(new Error("network failed"))).toBe(false)
		expect(isOverrideSummaryAlreadySettled({ code: 43206 })).toBe(false)
	})
})
