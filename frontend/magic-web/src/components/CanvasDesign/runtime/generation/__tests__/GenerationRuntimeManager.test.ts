import { describe, expect, it, vi } from "vitest"
import { GenerationRuntimeManager } from "../GenerationRuntimeManager"
import { EventEmitter } from "../../core/EventEmitter"

describe("GenerationRuntimeManager", () => {
	it("keeps runtime state outside element data and notifies only the target", () => {
		const manager = new GenerationRuntimeManager()
		const targetListener = vi.fn()
		const otherListener = vi.fn()
		manager.subscribeElement("image-1", targetListener)
		manager.subscribeElement("image-2", otherListener)

		const attemptId = manager.beginAttempt({
			attemptId: "attempt-1",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [
				{
					elementId: "image-1",
					generateImageRequest: { image_id: "request-1", model_id: "model" },
				},
			],
		})

		expect(attemptId).toBe("attempt-1")
		expect(manager.getTargetState("image-1")).toMatchObject({
			attemptId: "attempt-1",
			operation: "image-generate",
			phase: "submitting",
			generateImageRequest: { image_id: "request-1" },
		})
		expect(targetListener).toHaveBeenCalledTimes(1)
		expect(otherListener).not.toHaveBeenCalled()

		manager.completeAttempt(attemptId)
		expect(manager.getTargetState("image-1")).toBeNull()
		expect(targetListener).toHaveBeenCalledTimes(2)
	})

	it("tracks submission phases independently from generation attempts", () => {
		const manager = new GenerationRuntimeManager()
		const listener = vi.fn()
		manager.subscribeElement("video-1", listener)

		const submissionId = manager.beginSubmission({
			elementId: "video-1",
			contentId: "content-1",
			phase: "validating",
		})

		expect(manager.getSubmissionState("video-1", "content-1")).toMatchObject({
			submissionId,
			elementId: "video-1",
			contentId: "content-1",
			phase: "validating",
		})
		expect(manager.hasActiveGeneration("video-1", "content-1")).toBe(false)
		expect(listener).toHaveBeenCalledTimes(1)

		expect(manager.updateSubmissionPhase(submissionId, "submitting")).toBe(true)
		expect(manager.getSubmissionState("video-1", "content-1")?.phase).toBe("submitting")
		expect(manager.getComplianceState("video-1", "content-1")).toBeNull()
		expect(listener).toHaveBeenCalledTimes(2)

		expect(manager.clearSubmission(submissionId)).toBe(true)
		expect(manager.getSubmissionState("video-1", "content-1")).toBeNull()
		expect(listener).toHaveBeenCalledTimes(3)
	})

	it("keeps the newest Content submission when an older token settles", () => {
		const manager = new GenerationRuntimeManager()
		const olderId = manager.beginSubmission({
			elementId: "video-1",
			contentId: "content-1",
			phase: "preparing",
		})
		manager.beginSubmission({
			elementId: "video-1",
			contentId: "content-2",
			phase: "submitting",
		})
		const newestId = manager.beginSubmission({
			elementId: "video-1",
			contentId: "content-1",
			phase: "validating",
		})

		expect(manager.getSubmissionState("video-1")?.submissionId).toBe(newestId)
		expect(manager.clearSubmission(olderId)).toBe(false)
		expect(manager.getSubmissionState("video-1", "content-1")?.submissionId).toBe(newestId)
	})

	it("clears a submission when its Content is deleted", () => {
		const manager = new GenerationRuntimeManager()
		manager.beginSubmission({
			elementId: "video-1",
			contentId: "content-1",
			phase: "preparing",
		})

		manager.clearTarget("video-1", "content-1")

		expect(manager.getSubmissionState("video-1", "content-1")).toBeNull()
	})

	it("supersedes an older attempt for the same element", () => {
		const manager = new GenerationRuntimeManager()
		manager.beginAttempt({
			attemptId: "older",
			operation: "video-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "video-1" }],
		})

		manager.beginAttempt({
			attemptId: "newer",
			operation: "video-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "video-1" }],
		})

		expect(manager.isCurrent("older", "video-1")).toBe(false)
		expect(manager.isCurrent("older")).toBe(false)
		expect(manager.isCurrent("newer", "video-1")).toBe(true)
		expect(manager.completeAttempt("older")).toBeNull()
		expect(manager.getTargetState("video-1")?.attemptId).toBe("newer")
	})

	it("keeps concurrent image version targets isolated on one element", () => {
		const manager = new GenerationRuntimeManager()
		const first = manager.beginAttempt({
			attemptId: "version-1",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "v1" }],
		})
		const second = manager.beginAttempt({
			attemptId: "version-2",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "v2" }],
		})

		expect(manager.isCurrent(first, "image-1", "v1")).toBe(true)
		expect(manager.isCurrent(second, "image-1", "v2")).toBe(true)
		expect(manager.getTargetState("image-1")).toMatchObject({
			attemptId: second,
			contentId: "v2",
		})

		manager.completeAttempt(first)
		expect(manager.isCurrent(second, "image-1", "v2")).toBe(true)
		expect(manager.getTargetState("image-1")?.contentId).toBe("v2")
	})

	it("reads the runtime state for the requested Content instead of the latest sibling", () => {
		const manager = new GenerationRuntimeManager()
		manager.beginAttempt({
			attemptId: "version-a",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "a" }],
		})
		manager.beginAttempt({
			attemptId: "version-b",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "b" }],
		})

		expect(manager.getTargetState("image-1", "a")?.attemptId).toBe("version-a")
		expect(manager.getTargetState("image-1", "b")?.attemptId).toBe("version-b")
		expect(manager.hasActiveGeneration("image-1", "a")).toBe(true)
		expect(manager.hasActiveGeneration("image-1", "b")).toBe(true)
		expect(manager.hasActiveGeneration("image-1", "missing")).toBe(false)
		expect(manager.hasActiveGeneration("image-1")).toBe(true)
	})

	it("clears one deleted Content target without affecting sibling attempts", () => {
		const manager = new GenerationRuntimeManager()
		manager.beginAttempt({
			attemptId: "content-a-attempt",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "a" }],
		})
		manager.beginAttempt({
			attemptId: "content-b-attempt",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "b" }],
		})

		manager.clearTarget("image-1", "a")

		expect(manager.hasActiveGeneration("image-1", "a")).toBe(false)
		expect(manager.hasActiveGeneration("image-1", "b")).toBe(true)
		expect(manager.getAttempt("content-a-attempt")).toBeNull()
		expect(manager.getAttempt("content-b-attempt")).not.toBeNull()
	})

	it("rejects duplicate attempts for the same Content while allowing sibling Content", () => {
		const manager = new GenerationRuntimeManager()
		manager.beginAttempt({
			attemptId: "content-a-1",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1", contentId: "a" }],
		})

		expect(() =>
			manager.beginAttempt({
				attemptId: "content-a-2",
				operation: "image-high",
				failurePolicy: "restore-existing",
				targets: [{ elementId: "image-1", contentId: "a" }],
			}),
		).toThrow("already has an active attempt")

		expect(() =>
			manager.beginAttempt({
				attemptId: "content-b-1",
				operation: "image-generate",
				failurePolicy: "restore-existing",
				targets: [{ elementId: "image-1", contentId: "b" }],
			}),
		).not.toThrow()
	})

	it("updates a batch phase and clears all remaining current targets atomically", () => {
		const manager = new GenerationRuntimeManager()
		const firstListener = vi.fn()
		const secondListener = vi.fn()
		manager.subscribeElement("image-1", firstListener)
		manager.subscribeElement("image-2", secondListener)
		manager.beginAttempt({
			attemptId: "batch",
			operation: "image-batch",
			phase: "preparing",
			failurePolicy: "remove-placeholder",
			targets: [
				{ elementId: "image-1", outputIndex: 1 },
				{ elementId: "image-2", outputIndex: 2 },
			],
		})

		expect(manager.updateAttemptPhase("batch", "submitting")).toBe(true)
		expect(manager.getTargetState("image-1")?.phase).toBe("submitting")
		expect(manager.getTargetState("image-2")?.phase).toBe("submitting")

		manager.failAttempt("batch")
		expect(manager.getTargetState("image-1")).toBeNull()
		expect(manager.getTargetState("image-2")).toBeNull()
		expect(firstListener).toHaveBeenCalledTimes(3)
		expect(secondListener).toHaveBeenCalledTimes(3)
	})

	it("removes only the deleted target from a shared attempt", () => {
		const manager = new GenerationRuntimeManager()
		manager.beginAttempt({
			attemptId: "batch",
			operation: "image-batch",
			failurePolicy: "remove-placeholder",
			targets: [{ elementId: "image-1" }, { elementId: "image-2" }],
		})

		manager.clearElement("image-1")

		expect(manager.getTargetState("image-1")).toBeNull()
		expect(manager.isCurrent("batch", "image-2")).toBe(true)
		expect(manager.getAttempt("batch")?.targets).toEqual([{ elementId: "image-2" }])
	})

	it("cleans the target when the element is deleted as runtime-only", () => {
		const eventEmitter = new EventEmitter()
		const manager = new GenerationRuntimeManager({
			canvas: { eventEmitter } as never,
		})
		manager.beginAttempt({
			attemptId: "runtime-only-delete",
			operation: "image-generate",
			failurePolicy: "promote-empty",
			targets: [{ elementId: "image-1" }],
		})

		eventEmitter.emit({
			type: "element:deleted",
			data: { elementId: "image-1", persistence: "runtime-only" },
		})

		expect(manager.getTargetState("image-1")).toBeNull()
		expect(manager.getAttempt("runtime-only-delete")).toBeNull()
	})
})
