import { IDBFactory } from "fake-indexeddb"
import { shadow, shadowV2 } from "@/utils/shadow"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { enqueueOptimisticSave, FileSaveQueue, stringifySaveContent } from "../FileSaveQueue"
import { createMemoryFileSavePersistence, IndexedDbFileSavePersistence } from "../persistence"
import {
	FILE_SAVE_STATUS,
	FileSaveConflictError,
	FileSavePermanentError,
	FileSaveRetryableError,
	type FileSaveJob,
} from "../types"

function createJob(overrides: Partial<FileSaveJob> & Pick<FileSaveJob, "persist">): FileSaveJob {
	return {
		fileId: "file-1",
		content: "<p>Hello</p>",
		enableShadow: false,
		...overrides,
	}
}

describe("FileSaveQueue", () => {
	let persistence: ReturnType<typeof createMemoryFileSavePersistence>
	let delayed: Array<() => void>

	beforeEach(() => {
		persistence = createMemoryFileSavePersistence()
		delayed = []
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		delayed.forEach((resolve) => resolve())
		vi.restoreAllMocks()
	})

	function createQueue() {
		return new FileSaveQueue({
			persistence,
			delay: () =>
				new Promise<void>((resolve) => {
					delayed.push(resolve)
				}),
			now: () => 1,
			maxAttempts: 4,
			backoffMs: [1000, 3000, 8000],
		})
	}

	it("恢复 V2 草稿时提供原文而不改写待提交载荷", async () => {
		const content = shadowV2("저\u1000\ufeff")
		const queue = createQueue()
		queue.enqueue(
			createJob({
				content,
				enableShadow: true,
				persist: vi.fn().mockRejectedValue(new FileSavePermanentError("mock-error")),
			}),
		)
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
		expect(queue.peekUnsyncedDraft("file-1")).toBe("저\u1000\ufeff")
		expect((await persistence.get("file-1"))?.content).toBe(content)
	})

	it("coalesces to the latest content while a persist is in flight", async () => {
		let resolveFirst: (() => void) | undefined
		const persist = vi.fn((request: { content: unknown }) => {
			if (persist.mock.calls.length === 1) {
				return new Promise<void>((resolve) => {
					resolveFirst = resolve
				})
			}
			expect(request.content).toBe("<p>Second</p>")
			return Promise.resolve()
		})
		const queue = createQueue()
		queue.enqueue(createJob({ persist, content: "<p>First</p>" }))
		queue.enqueue(createJob({ persist, content: "<p>Second</p>" }))
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Saving)
		await vi.waitFor(async () =>
			expect(stringifySaveContent((await persistence.get("file-1"))?.content)).toBe(
				"<p>Second</p>",
			),
		)

		resolveFirst?.()
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(persist).toHaveBeenCalledTimes(2)
		expect(await persistence.get("file-1")).toBeUndefined()
	})

	it("keeps flush pending when a newer save is queued during success cleanup", async () => {
		let releaseOnSuccess: (() => void) | undefined
		let resolveSecond: (() => void) | undefined
		const persist = vi.fn((request: { content: unknown }) => {
			if (request.content === "<p>Second</p>") {
				return new Promise<void>((resolve) => {
					resolveSecond = resolve
				})
			}
			return Promise.resolve()
		})
		const queue = createQueue()
		queue.enqueue(
			createJob({
				persist,
				content: "<p>First</p>",
				onSuccess: () =>
					new Promise<void>((resolve) => {
						releaseOnSuccess = resolve
					}),
			}),
		)
		await vi.waitFor(() => expect(releaseOnSuccess).toBeDefined())

		const flushed = vi.fn()
		void queue.flush("file-1").then(flushed)
		queue.enqueue(createJob({ persist, content: "<p>Second</p>" }))
		releaseOnSuccess?.()

		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2))
		expect(flushed).not.toHaveBeenCalled()

		resolveSecond?.()
		await vi.waitFor(() => expect(flushed).toHaveBeenCalledWith(true))
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle)
	})

	it("retries retryable errors with backoff then succeeds", async () => {
		const persist = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(undefined)
		const onSuccess = vi.fn()
		const queue = createQueue()
		queue.enqueue(createJob({ persist, onSuccess }))
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Retrying))
		expect(delayed).toHaveLength(1)
		delayed[0]?.()
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(onSuccess).toHaveBeenCalledTimes(1)
		expect(persist).toHaveBeenCalledTimes(2)
	})

	it("retries errors marked retryable even without a network signature", async () => {
		const persist = vi
			.fn()
			.mockRejectedValueOnce(new FileSaveRetryableError("empty result"))
			.mockResolvedValueOnce(undefined)
		const queue = createQueue()
		queue.enqueue(createJob({ persist }))
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Retrying))
		delayed[0]?.()
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(persist).toHaveBeenCalledTimes(2)
	})

	it("rebases a queued save onto the version the previous save produced", async () => {
		let resolveFirst: ((value: { version: string }) => void) | undefined
		const persist = vi.fn((request: { content: unknown }) => {
			if (request.content === "<p>First</p>") {
				return new Promise<{ version: string }>((resolve) => {
					resolveFirst = resolve
				})
			}
			return Promise.resolve(undefined)
		})
		const queue = createQueue()
		queue.enqueue(createJob({ persist, content: "<p>First</p>", baselineVersion: "3" }))
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
		queue.enqueue(createJob({ persist, content: "<p>Second</p>", baselineVersion: "3" }))
		resolveFirst?.({ version: "4" })
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(persist).toHaveBeenCalledTimes(2)
		expect(persist.mock.calls[1]?.[0]).toMatchObject({ baselineVersion: "4" })
	})

	it("keeps a newer caller baseline over the version the queue observed", async () => {
		let resolveFirst: ((value: { version: string }) => void) | undefined
		const persist = vi.fn((request: { content: unknown }) => {
			if (request.content === "<p>First</p>") {
				return new Promise<{ version: string }>((resolve) => {
					resolveFirst = resolve
				})
			}
			return Promise.resolve(undefined)
		})
		const queue = createQueue()
		queue.enqueue(createJob({ persist, content: "<p>First</p>", baselineVersion: "3" }))
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
		queue.enqueue(createJob({ persist, content: "<p>Second</p>", baselineVersion: "6" }))
		resolveFirst?.({ version: "4" })
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(persist.mock.calls[1]?.[0]).toMatchObject({ baselineVersion: "6" })
	})

	it("does not let a slow draft mirror outlive the cleanup after a successful save", async () => {
		let releaseMirror: (() => void) | undefined
		const gate = new Promise<void>((resolve) => {
			releaseMirror = resolve
		})
		const slowPersistence = {
			...persistence,
			put: async (record: Parameters<typeof persistence.put>[0]) => {
				await gate
				await persistence.put(record)
			},
		}
		const queue = new FileSaveQueue({
			persistence: slowPersistence,
			delay: () => Promise.resolve(),
			now: () => 1,
		})
		queue.enqueue(createJob({ persist: vi.fn().mockResolvedValue(undefined) }))
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		releaseMirror?.()
		await queue.flush("file-1")
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await persistence.get("file-1")).toBeUndefined()
	})

	it("reveals a failure again on request", () => {
		const queue = createQueue()
		expect(queue.getFailureRevealToken("file-1")).toBe(0)
		const listener = vi.fn()
		queue.subscribe(listener)
		queue.revealFailure("file-1")
		expect(queue.getFailureRevealToken("file-1")).toBe(1)
		expect(listener).toHaveBeenCalled()
	})

	it("marks permanent errors as failed without retrying", async () => {
		const persist = vi.fn().mockRejectedValue(new FileSavePermanentError("denied"))
		const queue = createQueue()
		queue.enqueue(createJob({ persist }))
		await expect(queue.flush("file-1")).resolves.toBe(false)
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed)
		expect(persist).toHaveBeenCalledTimes(1)
		expect(await persistence.get("file-1")).toMatchObject({ content: "<p>Hello</p>" })
	})

	it("does not retry conflict errors", async () => {
		const persist = vi.fn().mockRejectedValue(new FileSaveConflictError())
		const queue = createQueue()
		queue.enqueue(createJob({ persist }))
		await vi.waitFor(() => expect(queue.getSnapshot("file-1")?.failReason).toBe("conflict"))
		expect(persist).toHaveBeenCalledTimes(1)
	})

	it("retry after failure re-persists the latest draft", async () => {
		const persist = vi
			.fn()
			.mockRejectedValueOnce(new FileSavePermanentError("denied"))
			.mockResolvedValueOnce(undefined)
		const queue = createQueue()
		queue.enqueue(createJob({ persist }))
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
		queue.retry("file-1")
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(persist).toHaveBeenCalledTimes(2)
	})

	it("restoreRemote drops the draft and IndexedDB record", async () => {
		const persist = vi.fn().mockRejectedValue(new FileSavePermanentError("denied"))
		const restore = vi.fn()
		const queue = createQueue()
		queue.registerRestoreHandler("file-1", restore)
		queue.enqueue(createJob({ persist }))
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
		await queue.restoreRemote("file-1")
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle)
		expect(await persistence.get("file-1")).toBeUndefined()
		expect(restore).toHaveBeenCalledTimes(1)
	})

	it("mirrors failed drafts to IndexedDB, not localStorage", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		const setItem = vi.spyOn(Storage.prototype, "setItem")
		try {
			const idbPersistence = new IndexedDbFileSavePersistence()
			const persist = vi.fn().mockRejectedValue(new FileSavePermanentError("denied"))
			const queue = new FileSaveQueue({
				persistence: idbPersistence,
				delay: () => Promise.resolve(),
				now: () => 1,
			})
			queue.enqueue(createJob({ persist, baselineVersion: "v2" }))
			await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
			expect(persist).toHaveBeenCalledTimes(1)
			expect(await idbPersistence.get("file-1")).toMatchObject({
				fileId: "file-1",
				content: "<p>Hello</p>",
				baselineVersion: "v2",
			})
			expect(setItem).not.toHaveBeenCalled()

			const recoveredQueue = new FileSaveQueue({
				persistence: idbPersistence,
				delay: () => Promise.resolve(),
				now: () => 1,
			})
			await expect(recoveredQueue.recover()).resolves.toEqual([
				{ fileId: "file-1", content: "<p>Hello</p>", baselineVersion: "v2" },
			])
			expect(recoveredQueue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed)
		} finally {
			setItem.mockRestore()
			vi.unstubAllGlobals()
		}
	})

	it("recovers failed drafts from IndexedDB", async () => {
		await persistence.put({
			fileId: "file-1",
			content: "<p>Draft</p>",
			enableShadow: false,
			baselineVersion: "v1",
			updatedAt: 1,
		})
		const queue = createQueue()
		const drafts = await queue.recover()
		expect(drafts).toEqual([
			{ fileId: "file-1", content: "<p>Draft</p>", baselineVersion: "v1" },
		])
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed)
	})

	it("rebinds persist so recovered drafts can retry", async () => {
		await persistence.put({
			fileId: "file-1",
			content: "<p>Draft</p>",
			enableShadow: false,
			baselineVersion: "v1",
			updatedAt: 1,
		})
		const queue = createQueue()
		await queue.recover()
		const persist = vi.fn().mockResolvedValue(undefined)
		queue.rebindPersist("file-1", persist)
		queue.retry("file-1")
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(persist).toHaveBeenCalledTimes(1)
		expect(persist.mock.calls[0]?.[0]).toMatchObject({
			fileId: "file-1",
			content: "<p>Draft</p>",
			baselineVersion: "v1",
		})
	})

	it("flush waits until persist finishes", async () => {
		let resolvePersist: (() => void) | undefined
		const persist = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePersist = resolve
				}),
		)
		const queue = createQueue()
		queue.enqueue(createJob({ persist }))
		let flushed: boolean | undefined
		const flushPromise = queue.flush("file-1").then((ok) => {
			flushed = ok
		})
		expect(flushed).toBeUndefined()
		resolvePersist?.()
		await flushPromise
		expect(flushed).toBe(true)
	})

	it("registers beforeunload while a save is unsynced", async () => {
		const add = vi.spyOn(window, "addEventListener")
		const remove = vi.spyOn(window, "removeEventListener")
		let resolvePersist: (() => void) | undefined
		const persist = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePersist = resolve
				}),
		)
		const queue = createQueue()
		queue.enqueue(createJob({ persist }))
		expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function))
		resolvePersist?.()
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function))
	})

	it("previews decoded code while persisting the original shadowed payload", async () => {
		const queue = createQueue()
		const first = shadow("const value = 1;")
		const latest = shadow("const value = 2;")
		let release: (() => void) | undefined
		const persist = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		queue.enqueue(createJob({ persist, content: first, enableShadow: true }))
		expect(queue.peekUnsyncedDraft("file-1")).toBe("const value = 1;")
		queue.enqueue(createJob({ persist, content: latest, enableShadow: true }))
		expect(queue.peekUnsyncedDraft("file-1")).toBe("const value = 2;")
		const handler = vi.fn()
		const unregister = queue.registerDraftApplyHandler("file-1", handler)
		expect(handler).toHaveBeenCalledWith("const value = 2;")
		await vi.waitFor(async () =>
			expect((await persistence.get("file-1"))?.content).toBe(latest),
		)
		expect(persist).toHaveBeenCalledWith(
			expect.objectContaining({ content: first, enableShadow: true }),
		)
		release?.()
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2))
		expect(persist).toHaveBeenLastCalledWith(
			expect.objectContaining({ content: latest, enableShadow: true }),
		)
		release?.()
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))
		expect(queue.peekUnsyncedDraft("file-1")).toBeUndefined()
		unregister()
	})

	it("keeps decoded code available during retry and after save failure", async () => {
		const queue = createQueue()
		queue.enqueue(
			createJob({
				content: shadow("const retry = true;"),
				enableShadow: true,
				persist: async () => {
					throw new TypeError("Failed to fetch")
				},
			}),
		)
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Retrying))
		expect(queue.peekUnsyncedDraft("file-1")).toBe("const retry = true;")
		for (let attempt = 1; attempt <= 3; attempt += 1) {
			await vi.waitFor(() => expect(delayed).toHaveLength(attempt))
			delayed[attempt - 1]()
		}
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
		expect(queue.peekUnsyncedDraft("file-1")).toBe("const retry = true;")
		await queue.restoreRemote("file-1")
	})

	it.each([false, true])(
		"decodes recovered shadowed drafts with late registration: %s",
		async (late) => {
			const content = shadow("const recovered = true;")
			await persistence.put({ fileId: "file-1", content, enableShadow: true, updatedAt: 1 })
			const queue = createQueue()
			const handler = vi.fn()
			let unregister: (() => void) | undefined
			if (!late) unregister = queue.registerDraftApplyHandler("file-1", handler)
			await queue.recover()
			if (late) unregister = queue.registerDraftApplyHandler("file-1", handler)
			expect(handler).toHaveBeenCalledWith("const recovered = true;")
			expect(queue.peekUnsyncedDraft("file-1")).toBe("const recovered = true;")
			expect(queue.getSnapshot("file-1")?.pendingContent).toBe(content)
			unregister?.()
			await queue.restoreRemote("file-1")
		},
	)

	it.each([
		{ content: "SHADOWED_literal text", enableShadow: false },
		{ content: "plain text", enableShadow: true },
		{ content: { text: "SHADOWED_literal text" }, enableShadow: true },
	])("preserves unencoded drafts: $content", async ({ content, enableShadow }) => {
		const queue = createQueue()
		queue.enqueue(
			createJob({
				content,
				enableShadow,
				persist: async () => {
					throw new FileSavePermanentError()
				},
			}),
		)
		expect(queue.peekUnsyncedDraft("file-1")).toBe(content)
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
		expect(queue.peekUnsyncedDraft("file-1")).toBe(content)
		await queue.restoreRemote("file-1")
	})

	it("applies recovered drafts through the registered handler", async () => {
		await persistence.put({
			fileId: "file-1",
			content: "<p>Draft</p>",
			enableShadow: false,
			baselineVersion: "v1",
			updatedAt: 1,
		})
		const queue = createQueue()
		const handler = vi.fn()
		queue.registerDraftApplyHandler("file-1", handler)
		expect(handler).not.toHaveBeenCalled()
		await queue.recover()
		expect(handler).toHaveBeenCalledWith("<p>Draft</p>")
		expect(queue.peekUnsyncedDraft("file-1")).toBe("<p>Draft</p>")
	})

	it("applies recovered drafts when the handler registers after recover", async () => {
		await persistence.put({
			fileId: "file-1",
			content: "<p>Draft</p>",
			enableShadow: false,
			updatedAt: 1,
		})
		const queue = createQueue()
		await queue.recover()
		const handler = vi.fn()
		queue.registerDraftApplyHandler("file-1", handler)
		expect(handler).toHaveBeenCalledWith("<p>Draft</p>")
	})

	it("does not overwrite a live entry with a stale stored draft", async () => {
		await persistence.put({
			fileId: "file-1",
			content: "<p>Stale</p>",
			enableShadow: false,
			updatedAt: 1,
		})
		const queue = createQueue()
		const persist = vi.fn(() => new Promise<void>(() => {}))
		queue.enqueue(createJob({ persist, content: "<p>Live</p>" }))
		await expect(queue.recover()).resolves.toEqual([])
		expect(queue.peekUnsyncedDraft("file-1")).toBe("<p>Live</p>")
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Saving)
	})

	it("prunes expired drafts on recover", async () => {
		await persistence.put({
			fileId: "old",
			content: "<p>Old</p>",
			enableShadow: false,
			updatedAt: 1,
		})
		const queue = new FileSaveQueue({
			persistence,
			delay: () => Promise.resolve(),
			now: () => 1 + 8 * 24 * 60 * 60 * 1000,
		})
		await expect(queue.recover()).resolves.toEqual([])
		expect(await persistence.get("old")).toBeUndefined()
	})

	it("keeps oversized drafts in memory but skips IndexedDB", async () => {
		const persist = vi.fn().mockRejectedValue(new FileSavePermanentError("denied"))
		const queue = new FileSaveQueue({
			persistence,
			delay: () => Promise.resolve(),
			now: () => 1,
			maxDraftBytesPerRecord: 16,
		})
		queue.enqueue(createJob({ persist, content: "x".repeat(200) }))
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Failed))
		expect(await persistence.get("file-1")).toBeUndefined()
		expect(queue.peekUnsyncedDraft("file-1")).toBe("x".repeat(200))
	})

	it("caps persisted drafts by record count, keeping the newest", async () => {
		let clock = 0
		const queue = new FileSaveQueue({
			persistence,
			delay: () => Promise.resolve(),
			now: () => ++clock,
			maxDraftRecords: 2,
		})
		const persist = vi.fn().mockRejectedValue(new FileSavePermanentError("denied"))
		for (const fileId of ["a", "b", "c"]) {
			queue.enqueue(createJob({ persist, fileId }))
			await vi.waitFor(() => expect(queue.getStatus(fileId)).toBe(FILE_SAVE_STATUS.Failed))
			await vi.waitFor(async () => expect(await persistence.get(fileId)).toBeDefined())
		}
		await vi.waitFor(async () => {
			const ids = (await persistence.getAll()).map((record) => record.fileId).sort()
			expect(ids).toEqual(["b", "c"])
		})
	})

	it("enqueueOptimisticSave resolves immediately unless awaitPersist is set", async () => {
		let resolvePersist: (() => void) | undefined
		const persist = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePersist = resolve
				}),
		)
		const queue = createQueue()
		await expect(enqueueOptimisticSave(createJob({ persist }), undefined, queue)).resolves.toBe(
			true,
		)
		expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Saving)
		resolvePersist?.()
		await vi.waitFor(() => expect(queue.getStatus("file-1")).toBe(FILE_SAVE_STATUS.Idle))

		const failing = vi.fn().mockRejectedValue(new FileSavePermanentError("denied"))
		await expect(
			enqueueOptimisticSave(
				createJob({ persist: failing, fileId: "file-2" }),
				{ awaitPersist: true },
				queue,
			),
		).resolves.toBe(false)
	})
})
