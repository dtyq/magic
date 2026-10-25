import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	AsyncPublishError,
	clearPendingPublishTask,
	loadPendingPublishTask,
	pollPublishTask,
	resumePendingPublish,
	runAsyncPublish,
	savePendingPublishTask,
} from "../asyncPublish"

describe("asyncPublish", () => {
	beforeEach(() => {
		sessionStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		sessionStorage.clear()
	})

	it("persists and clears pending publish task ids", () => {
		savePendingPublishTask("skill", "SK-1", "task-1")
		expect(loadPendingPublishTask("skill", "SK-1")).toEqual({ publish_task_id: "task-1" })
		clearPendingPublishTask("skill", "SK-1")
		expect(loadPendingPublishTask("skill", "SK-1")).toBeNull()
	})

	it("persists draft snapshots for resume", () => {
		const draft = {
			version: "1.0.1",
			details: "notes",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		}
		savePendingPublishTask("agent", "SMA-draft", "task-draft", draft)
		expect(loadPendingPublishTask("agent", "SMA-draft")).toEqual({
			publish_task_id: "task-draft",
			draft,
		})
	})

	it("reads legacy plain-string publish_task_id values", () => {
		sessionStorage.setItem("async-publish-task:skill:SK-legacy", "legacy-task")
		expect(loadPendingPublishTask("skill", "SK-legacy")).toEqual({
			publish_task_id: "legacy-task",
		})
	})

	it("returns immediately when create responds ready", async () => {
		const result = await runAsyncPublish({
			resourceType: "agent",
			code: "SMA-1",
			create: async () => ({
				publish_task_id: "task-ready",
				status: "ready",
				progress: 100,
				error: null,
			}),
			check: async () => {
				throw new Error("check should not be called")
			},
		})

		expect(result.status).toBe("ready")
		expect(loadPendingPublishTask("agent", "SMA-1")).toBeNull()
	})

	it("polls until ready and reports progress", async () => {
		const progressValues: number[] = []
		let checks = 0

		const promise = runAsyncPublish({
			resourceType: "skill",
			code: "SK-2",
			draft: { version: "1.0.0" },
			create: async () => ({
				publish_task_id: "task-2",
				status: "processing",
				progress: 10,
				error: null,
			}),
			check: async () => {
				checks += 1
				if (checks === 1) {
					expect(loadPendingPublishTask("skill", "SK-2")).toEqual({
						publish_task_id: "task-2",
						draft: { version: "1.0.0" },
					})
					return {
						publish_task_id: "task-2",
						status: "processing",
						progress: 60,
						error: null,
					}
				}
				return {
					publish_task_id: "task-2",
					status: "ready",
					progress: 100,
					error: null,
				}
			},
			onProgress: (progress) => progressValues.push(progress),
		})

		await vi.advanceTimersByTimeAsync(2500)
		await vi.advanceTimersByTimeAsync(2500)
		const result = await promise

		expect(result.status).toBe("ready")
		expect(progressValues).toEqual([10, 60, 100])
		expect(loadPendingPublishTask("skill", "SK-2")).toBeNull()
	})

	it("throws AsyncPublishError when status is failed", async () => {
		const promise = pollPublishTask({
			check: async () => ({
				publish_task_id: "task-3",
				status: "failed",
				progress: 40,
				error: "zip failed",
			}),
		})

		await expect(promise).rejects.toMatchObject({
			name: "AsyncPublishError",
			reason: "failed",
			message: "zip failed",
		})
	})

	it("resumes from an existing publish_task_id", async () => {
		savePendingPublishTask("agent", "SMA-9", "task-resume")

		const promise = runAsyncPublish({
			resourceType: "agent",
			code: "SMA-9",
			resumePublishTaskId: "task-resume",
			create: async () => {
				throw new Error("should not create")
			},
			check: async () => ({
				publish_task_id: "task-resume",
				status: "ready",
				progress: 100,
				error: null,
			}),
		})

		const result = await promise
		expect(result.status).toBe("ready")
		expect(loadPendingPublishTask("agent", "SMA-9")).toBeNull()
	})

	it("supports abort during polling", async () => {
		const controller = new AbortController()
		const promise = pollPublishTask({
			check: async () => ({
				publish_task_id: "task-abort",
				status: "processing",
				progress: 20,
				error: null,
			}),
			signal: controller.signal,
		})

		controller.abort()
		await expect(promise).rejects.toBeInstanceOf(AsyncPublishError)
	})

	it("resumes silently when the first check is already ready", async () => {
		savePendingPublishTask("agent", "SMA-ready", "task-ready")
		const onStartWaiting = vi.fn()
		const onProgress = vi.fn()

		const result = await resumePendingPublish({
			resourceType: "agent",
			code: "SMA-ready",
			publishTaskId: "task-ready",
			check: async () => ({
				publish_task_id: "task-ready",
				status: "ready",
				progress: 100,
				error: null,
			}),
			onStartWaiting,
			onProgress,
		})

		expect(result.alreadyReady).toBe(true)
		expect(onStartWaiting).not.toHaveBeenCalled()
		expect(onProgress).not.toHaveBeenCalled()
		expect(loadPendingPublishTask("agent", "SMA-ready")).toBeNull()
	})

	it("enters waiting UI only when resume is still processing", async () => {
		const draft = { version: "2.0.0" }
		savePendingPublishTask("skill", "SK-wait", "task-wait", draft)
		const onStartWaiting = vi.fn()
		const progressValues: number[] = []
		let checks = 0

		const promise = resumePendingPublish({
			resourceType: "skill",
			code: "SK-wait",
			publishTaskId: "task-wait",
			draft,
			check: async () => {
				checks += 1
				if (checks === 1) {
					return {
						publish_task_id: "task-wait",
						status: "processing",
						progress: 40,
						error: null,
					}
				}
				return {
					publish_task_id: "task-wait",
					status: "ready",
					progress: 100,
					error: null,
				}
			},
			onStartWaiting,
			onProgress: (progress) => progressValues.push(progress),
		})

		await vi.advanceTimersByTimeAsync(2500)
		const result = await promise

		expect(result.alreadyReady).toBe(false)
		expect(onStartWaiting).toHaveBeenCalledTimes(1)
		expect(onStartWaiting).toHaveBeenCalledWith(draft)
		expect(progressValues[0]).toBe(40)
		expect(progressValues.at(-1)).toBe(100)
		expect(loadPendingPublishTask("skill", "SK-wait")).toBeNull()
	})

	it("keeps the pending task on poll timeout so resume can continue", async () => {
		const draft = { version: "1.0.0" }
		const promise = runAsyncPublish({
			resourceType: "agent",
			code: "SMA-timeout",
			draft,
			create: async () => ({
				publish_task_id: "task-timeout",
				status: "processing",
				progress: 10,
				error: null,
			}),
			check: async () => ({
				publish_task_id: "task-timeout",
				status: "processing",
				progress: 10,
				error: null,
			}),
		})

		const pending = promise.catch((error: unknown) => error)
		for (let attempt = 0; attempt < 100; attempt += 1) {
			await vi.advanceTimersByTimeAsync(2500)
		}
		const error = await pending

		expect(error).toMatchObject({
			name: "AsyncPublishError",
			reason: "timeout",
		})
		expect(loadPendingPublishTask("agent", "SMA-timeout")).toEqual({
			publish_task_id: "task-timeout",
			draft,
		})
	})

	it("clears the pending task when poll status is failed", async () => {
		const promise = runAsyncPublish({
			resourceType: "skill",
			code: "SK-failed",
			draft: { version: "1.0.0" },
			create: async () => ({
				publish_task_id: "task-failed",
				status: "processing",
				progress: 10,
				error: null,
			}),
			check: async () => ({
				publish_task_id: "task-failed",
				status: "failed",
				progress: 10,
				error: "zip failed",
			}),
		})

		await expect(promise).rejects.toMatchObject({
			name: "AsyncPublishError",
			reason: "failed",
		})
		expect(loadPendingPublishTask("skill", "SK-failed")).toBeNull()
	})

	it("does not create a second task when submitting again after timeout", async () => {
		const draft = { version: "1.0.0" }
		const create = vi.fn(async () => ({
			publish_task_id: "task-timeout",
			status: "processing" as const,
			progress: 10,
			error: null,
		}))
		const check = vi.fn(async () => ({
			publish_task_id: "task-timeout",
			status: "processing" as const,
			progress: 10,
			error: null,
		}))

		const first = runAsyncPublish({
			resourceType: "agent",
			code: "SMA-resubmit",
			draft,
			create,
			check,
		})
		const firstResult = first.catch((error: unknown) => error)
		for (let attempt = 0; attempt < 100; attempt += 1) {
			await vi.advanceTimersByTimeAsync(2500)
		}
		expect(await firstResult).toMatchObject({ reason: "timeout" })
		expect(create).toHaveBeenCalledTimes(1)

		check.mockResolvedValue({
			publish_task_id: "task-timeout",
			status: "ready",
			progress: 100,
			error: null,
		})

		const second = await runAsyncPublish({
			resourceType: "agent",
			code: "SMA-resubmit",
			draft,
			create,
			check,
		})

		expect(create).toHaveBeenCalledTimes(1)
		expect(second.status).toBe("ready")
		expect(loadPendingPublishTask("agent", "SMA-resubmit")).toBeNull()
	})

	it("creates a new task only after the stored pending task has failed", async () => {
		savePendingPublishTask("skill", "SK-retry", "task-old", { version: "1.0.0" })
		const create = vi.fn(async () => ({
			publish_task_id: "task-new",
			status: "ready" as const,
			progress: 100,
			error: null,
		}))
		const check = vi.fn(async () => ({
			publish_task_id: "task-old",
			status: "failed" as const,
			progress: 10,
			error: "zip failed",
		}))

		const result = await runAsyncPublish({
			resourceType: "skill",
			code: "SK-retry",
			create,
			check,
		})

		expect(create).toHaveBeenCalledTimes(1)
		expect(result).toMatchObject({ publish_task_id: "task-new", status: "ready" })
	})

	it("does not reuse an in-progress task when the draft fingerprint changed", async () => {
		const storedDraft = {
			version: "1.0.0",
			details: "old",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		}
		const nextDraft = {
			...storedDraft,
			version: "1.0.1",
			details: "new",
		}
		savePendingPublishTask("agent", "SMA-conflict", "task-old", storedDraft)

		const create = vi.fn(async () => ({
			publish_task_id: "task-new",
			status: "ready" as const,
			progress: 100,
			error: null,
		}))
		const check = vi.fn(async () => ({
			publish_task_id: "task-old",
			status: "processing" as const,
			progress: 40,
			error: null,
		}))

		await expect(
			runAsyncPublish({
				resourceType: "agent",
				code: "SMA-conflict",
				draft: nextDraft,
				create,
				check,
			}),
		).rejects.toMatchObject({
			name: "AsyncPublishError",
			reason: "conflict",
		})

		expect(create).not.toHaveBeenCalled()
		expect(loadPendingPublishTask("agent", "SMA-conflict")).toEqual({
			publish_task_id: "task-old",
			draft: storedDraft,
		})
	})
})
