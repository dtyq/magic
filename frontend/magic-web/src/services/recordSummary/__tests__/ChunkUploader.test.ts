import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { StoredAudioChunk, UploadStatus } from "../MediaRecorderService/AudioChunkDB"
import type { RecordingBatchSaveReporter } from "../RecordingBatchSaveReporter"
import { ChunkUploader } from "../ChunkUploader"

type PendingUpload = {
	success: (path?: string) => void
	fail: (error?: Error) => void
}

const testState = vi.hoisted(() => ({
	chunks: new Map<string, StoredAudioChunk>(),
	uploadBehaviors: [] as Array<"success" | "fail" | "hang">,
	uploadCalls: [] as Array<{ name: string; size: number; type: string }>,
	uploadCancels: [] as Array<ReturnType<typeof vi.fn>>,
	pendingUploads: [] as Array<PendingUpload | null>,
	uploadFailureError: null as unknown,
	loggerReports: [] as unknown[],
}))

vi.mock("@/services/recordSummary/utils/RecordingLogger", () => {
	const logger = {
		log: vi.fn(),
		report: vi.fn((...args: unknown[]) => {
			testState.loggerReports.push(args)
		}),
		warn: vi.fn(),
		error: vi.fn(),
		namespace: vi.fn(() => logger),
	}
	return { recordingLogger: logger }
})

vi.mock("@dtyq/upload-sdk", () => ({
	Upload: vi.fn().mockImplementation(() => ({
		upload: vi.fn(({ file }: { file: File }) => {
			testState.uploadCalls.push({ name: file.name, size: file.size, type: file.type })
			const behavior = testState.uploadBehaviors.shift() ?? "success"
			const cancel = vi.fn()
			testState.uploadCancels.push(cancel)
			let successCallback: ((response: { data: { path: string } }) => void) | undefined
			let failCallback: ((error: Error) => void) | undefined
			const pendingUpload: PendingUpload = {
				success: (path) => {
					successCallback?.({
						data: { path: path ?? `uploaded/${testState.uploadCalls.length}` },
					})
				},
				fail: (error) => {
					failCallback?.(
						error ??
							(testState.uploadFailureError as Error | null) ??
							new Error("upload failed"),
					)
				},
			}
			testState.pendingUploads.push(behavior === "hang" ? pendingUpload : null)
			return {
				cancel,
				success: (callback: (response: { data: { path: string } }) => void) => {
					successCallback = callback
					if (behavior === "success") {
						queueMicrotask(() =>
							callback({
								data: { path: `uploaded/${testState.uploadCalls.length}` },
							}),
						)
					}
				},
				fail: (callback: (error: Error) => void) => {
					failCallback = callback
					if (behavior === "fail") {
						queueMicrotask(() =>
							callback(
								(testState.uploadFailureError as Error | null) ??
									new Error("upload failed"),
							),
						)
					}
				},
			}
		}),
	})),
}))

vi.mock("../RecordingErrorManager", () => ({
	isTaskEndError: vi.fn(() => false),
}))

vi.mock("../MediaRecorderService/AudioChunkDB", () => ({
	AudioChunkDB: vi.fn().mockImplementation(() => ({
		get: vi.fn((id: string) => Promise.resolve(testState.chunks.get(id))),
		getChunksByUploadStatus: vi.fn((sessionId: string, status: UploadStatus) =>
			Promise.resolve(
				Array.from(testState.chunks.values()).filter(
					(chunk) => chunk.sessionId === sessionId && chunk.uploadStatus === status,
				),
			),
		),
		updateChunkUploadStatus: vi.fn((id: string, status: UploadStatus) => {
			const chunk = testState.chunks.get(id)
			if (chunk) {
				testState.chunks.set(id, { ...chunk, uploadStatus: status })
			}
			return Promise.resolve()
		}),
		getSessionUploadProgress: vi.fn((sessionId: string) => {
			const chunks = Array.from(testState.chunks.values()).filter(
				(chunk) => chunk.sessionId === sessionId,
			)
			const pending = chunks.filter((chunk) => chunk.uploadStatus === "pending").length
			const uploaded = chunks.filter((chunk) => chunk.uploadStatus === "uploaded").length
			const failed = chunks.filter((chunk) => chunk.uploadStatus === "failed").length
			return Promise.resolve({
				total: chunks.length,
				pending,
				uploaded,
				failed,
				settled: pending === 0 && uploaded + failed === chunks.length,
				completed: uploaded === chunks.length,
			})
		}),
		deletePendingSessionChunks: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("../UploadTokenManager", () => ({
	UploadTokenManager: vi.fn().mockImplementation(() => ({
		getToken: vi.fn().mockResolvedValue({
			platform: "TOS",
			temporary_credential: {},
			expire: Date.now() + 60_000,
		}),
		getDirectories: vi.fn(() => ({ asr_hidden_dir: { directory_id: "hidden-dir" } })),
		getSandboxTaskId: vi.fn(() => "sandbox-task-1"),
		getSandboxTopicId: vi.fn(() => "sandbox-topic-1"),
		getHiddenDirectoryPath: vi.fn(() => "/hidden-dir"),
		forceRefreshToken: vi.fn().mockResolvedValue(undefined),
		getTokenInfo: vi.fn(),
		cleanupExpiredTokens: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock("../NetworkMonitor", () => ({
	getNetworkMonitor: vi.fn(() => ({
		subscribe: vi.fn(() => vi.fn()),
		isNetworkOnline: vi.fn(() => true),
		isNetworkOffline: vi.fn(() => false),
	})),
}))

vi.mock("../utils/getSnowflakeUploadFileName", () => ({
	getSnowflakeUploadFileName: vi.fn().mockResolvedValue("snowflake.wav"),
}))

const createChunk = (index: number): StoredAudioChunk => ({
	id: `chunk-${index}`,
	sessionId: "session-1",
	chunk: new Blob([new Uint8Array([index])], { type: "audio/wav" }),
	index,
	timestamp: Date.now() + index,
	size: 1,
	mimeType: "audio/wav",
	uploadStatus: "pending",
})

const createBatchSaveReporter = (
	overrides: Partial<RecordingBatchSaveReporter> = {},
): RecordingBatchSaveReporter =>
	({
		reportUploadedFile: vi.fn().mockResolvedValue(undefined),
		reportUploadedFileStrict: vi.fn().mockResolvedValue(undefined),
		...overrides,
	}) as unknown as RecordingBatchSaveReporter

describe("ChunkUploader", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		testState.chunks.clear()
		testState.uploadBehaviors.length = 0
		testState.uploadCalls.length = 0
		testState.uploadCancels.length = 0
		testState.pendingUploads.length = 0
		testState.uploadFailureError = null
		testState.loggerReports.length = 0
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("times out a hung chunk, marks it failed after max retries, and continues the session queue", async () => {
		const firstChunk = createChunk(0)
		const secondChunk = createChunk(1)
		testState.chunks.set(firstChunk.id, firstChunk)
		testState.uploadBehaviors.push("hang", "fail", "success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
			{ onSuccess: vi.fn(), onMaxRetriesReached: vi.fn() },
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))

		testState.chunks.set(secondChunk.id, secondChunk)
		await uploader.uploadSession("session-1", "topic-1", "project-1")
		expect(testState.uploadCalls).toHaveLength(1)

		await vi.advanceTimersByTimeAsync(60_000)
		await vi.advanceTimersByTimeAsync(2_000)
		await vi.runAllTicks()
		await Promise.resolve()
		await Promise.resolve()

		expect(testState.chunks.get(firstChunk.id)?.uploadStatus).toBe("failed")
		expect(testState.chunks.get(secondChunk.id)?.uploadStatus).toBe("uploaded")
		expect(testState.uploadCalls).toHaveLength(3)
		expect(testState.uploadCancels[0]).toHaveBeenCalledTimes(1)
	})

	it("reports retry scheduling and retry start transitions", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("fail", "success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 2,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		await vi.advanceTimersByTimeAsync(2_000)
		await vi.waitFor(() =>
			expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("uploaded"),
		)

		const lifecycleEvents = testState.loggerReports
			.map((args) => args[0])
			.filter(
				(value): value is { namespace: string; data: { event: string } } =>
					typeof value === "object" &&
					value !== null &&
					(value as { namespace?: unknown }).namespace === "recordingUploadLifecycle",
			)
			.map((value) => value.data.event)

		expect(lifecycleEvents).toEqual(
			expect.arrayContaining(["chunk_retry_scheduled", "chunk_retry_started"]),
		)
	})

	it("retries an IndexedDB fallback upload and preserves BatchSave", async () => {
		const chunk = createChunk(0)
		testState.uploadBehaviors.push("fail", "success")
		const batchSaveReporter = createBatchSaveReporter()
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 2,
			},
			batchSaveReporter,
		)
		const internalUploader = uploader as unknown as {
			sessionTopicMap: Map<string, string>
			sessionProjectMap: Map<string, string>
			directUploadChunks: Map<string, StoredAudioChunk>
		}
		internalUploader.sessionTopicMap.set("session-1", "topic-1")
		internalUploader.sessionProjectMap.set("session-1", "project-1")

		await uploader.uploadChunkAndSave(chunk)
		await vi.advanceTimersByTimeAsync(2_000)
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(2))

		expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalledTimes(1)
		expect(internalUploader.directUploadChunks.has(chunk.id)).toBe(false)
	})

	it("cancels an active IndexedDB fallback upload during session cleanup", async () => {
		const chunk = createChunk(0)
		testState.uploadBehaviors.push("hang")
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)
		const internalUploader = uploader as unknown as {
			sessionTopicMap: Map<string, string>
			sessionProjectMap: Map<string, string>
		}
		internalUploader.sessionTopicMap.set("session-1", "topic-1")
		internalUploader.sessionProjectMap.set("session-1", "project-1")

		void uploader.uploadChunkAndSave(chunk)
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		await uploader.clearSessionChunks("session-1", "cancel:user_cancel")

		expect(testState.uploadCancels[0]).toHaveBeenCalledTimes(1)
	})

	it("starts only one active upload per session when multiple pending chunks are queued", async () => {
		testState.chunks.set("chunk-0", createChunk(0))
		testState.chunks.set("chunk-1", createChunk(1))
		testState.uploadBehaviors.push("hang", "hang")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls.length).toBeGreaterThan(0))

		expect(testState.uploadCalls).toHaveLength(1)
	})

	it("ignores an in-flight upload after session cleanup instead of retrying it", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("hang")
		const batchSaveReporter = createBatchSaveReporter()

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 1,
			},
			batchSaveReporter,
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))

		await uploader.clearSessionChunks("session-1", "cancel:user_cancel")
		await vi.advanceTimersByTimeAsync(60_000)
		await vi.runAllTicks()
		await Promise.resolve()

		expect(batchSaveReporter.reportUploadedFileStrict).not.toHaveBeenCalled()
		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("pending")
	})

	it("cancels an in-flight SDK upload when stopping a session and keeps the chunk", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("hang")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))

		uploader.stopSessionUploads("session-1", "task_end")

		expect(testState.uploadCancels[0]).toHaveBeenCalledTimes(1)
		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("pending")
	})

	it("redacts standalone bearer credentials from upload logs and errors", async () => {
		const fakeCredential = "test-upload-bearer-credential"
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("fail")
		testState.uploadFailureError = new Error(`Unauthorized Bearer ${fakeCredential}`)
		const onError = vi.fn()

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
			{ onError },
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))

		const failedRequestLog = testState.loggerReports
			.map((args) => args[0])
			.find(
				(value): value is { namespace: string; data: Record<string, unknown> } =>
					typeof value === "object" &&
					value !== null &&
					(value as { namespace?: unknown }).namespace === "recordingUpload",
			)

		expect(failedRequestLog).toEqual(
			expect.objectContaining({
				data: expect.objectContaining({
					message: `Unauthorized Bearer [REDACTED]`,
				}),
			}),
		)
		expect(JSON.stringify(failedRequestLog)).not.toContain(fakeCredential)
		expect(onError.mock.calls[0]?.[1]).toBeInstanceOf(Error)
		expect((onError.mock.calls[0]?.[1] as Error).message).not.toContain(fakeCredential)
	})

	it("clears stopped upload runtime state before late SDK callbacks arrive", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("hang")
		const batchSaveReporter = createBatchSaveReporter()
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			batchSaveReporter,
		)
		const internalUploader = uploader as unknown as {
			activeUploads: Map<string, StoredAudioChunk>
			activeUploadIds: Set<string>
			activeUploadAttempts: Map<string, string>
			activeUploadCancels: Map<string, () => void>
			retryTimers: Map<string, NodeJS.Timeout>
			sessionActiveUploads: Map<string, string | null>
		}

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))

		uploader.stopSessionUploads("session-1", "task_end")

		expect(internalUploader.activeUploads.has(chunk.id)).toBe(false)
		expect(internalUploader.activeUploadIds.has(chunk.id)).toBe(false)
		expect(internalUploader.activeUploadAttempts.has(chunk.id)).toBe(false)
		expect(internalUploader.activeUploadCancels.has(chunk.id)).toBe(false)
		expect(internalUploader.retryTimers.has(chunk.id)).toBe(false)
		expect(internalUploader.sessionActiveUploads.has("session-1")).toBe(false)

		testState.pendingUploads[0]?.success("uploaded/stale")
		testState.pendingUploads[0]?.fail(new Error("stale cancelled upload"))
		await vi.runAllTicks()
		await Promise.resolve()

		expect(batchSaveReporter.reportUploadedFileStrict).not.toHaveBeenCalled()
		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("pending")
	})

	it("does not reset failed chunks after a session has been stopped", async () => {
		const chunk = { ...createChunk(0), uploadStatus: "failed" as const }
		testState.chunks.set(chunk.id, chunk)
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		uploader.stopSessionUploads("session-1", "task_end")

		await expect(uploader.retryFailedChunks("session-1", "topic-1", "project-1")).resolves.toBe(
			0,
		)
		await expect(
			uploader.uploadEmptyPlaceholdersForFailedChunks("session-1", "topic-1", "project-1"),
		).resolves.toBe(0)
		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("failed")
		expect(testState.uploadCalls).toHaveLength(0)
	})

	it("does not mark a placeholder uploaded when stopping during batch save", async () => {
		const chunk = { ...createChunk(0), uploadStatus: "failed" as const }
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("success")
		let resolveBatchSave!: () => void
		const batchSaveReporter = createBatchSaveReporter({
			reportUploadedFileStrict: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						resolveBatchSave = resolve
					}),
			),
		})
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			batchSaveReporter,
		)

		const uploadPromise = uploader.uploadEmptyPlaceholdersForFailedChunks(
			"session-1",
			"topic-1",
			"project-1",
		)
		await vi.waitFor(() =>
			expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalledTimes(1),
		)

		uploader.stopSessionUploads("session-1", "task_end")
		resolveBatchSave()

		await expect(uploadPromise).rejects.toThrow("Session upload stopped")
		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("failed")
	})

	it("does not resume uploads after a session cleanup request", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.clearSessionChunks("session-1", "cancel:user_cancel")
		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1")

		expect(testState.uploadCalls).toHaveLength(0)
		const cleanupEvent = testState.loggerReports
			.map((args) => args[0])
			.find(
				(
					value,
				): value is {
					namespace: string
					data: { event: string; clearIndexedDB: boolean }
				} =>
					typeof value === "object" &&
					value !== null &&
					(value as { namespace?: unknown }).namespace === "recordingUploadLifecycle" &&
					(value as { data?: { event?: unknown } }).data?.event ===
						"session_upload_cleanup",
			)
		expect(cleanupEvent?.data.clearIndexedDB).toBe(true)
	})

	it("does not restart uploads after a session cleanup request", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.clearSessionChunks("session-1", "cancel:user_cancel")
		await uploader.uploadSession("session-1", "topic-1", "project-1")

		expect(testState.uploadCalls).toHaveLength(0)
	})

	it("does not throw when upload failure races with IndexedDB chunk deletion", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("fail")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)
		const internalUploader = uploader as unknown as {
			audioChunkDB: { get: (id: string) => Promise<StoredAudioChunk | undefined> }
			activeUploads: Map<string, StoredAudioChunk>
			activeUploadAttempts: Map<string, string>
			sessionActiveUploads: Map<string, string>
		}
		const originalGet = internalUploader.audioChunkDB.get.bind(internalUploader.audioChunkDB)
		let reads = 0
		internalUploader.audioChunkDB.get = vi.fn(async (id: string) => {
			reads += 1
			const stored = await originalGet(id)
			if (reads >= 2) {
				testState.chunks.delete(id)
				return undefined
			}
			return stored
		})

		await expect(
			uploader.uploadSession("session-1", "topic-1", "project-1"),
		).resolves.toBeUndefined()
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		await vi.runAllTicks()
		await Promise.resolve()
		await Promise.resolve()

		expect(internalUploader.activeUploads.has(chunk.id)).toBe(false)
		expect(internalUploader.activeUploadAttempts.has(chunk.id)).toBe(false)
		expect(internalUploader.sessionActiveUploads.has("session-1")).toBe(false)
	})

	it("clears leftover upload attempts when a missing chunk has no active session", async () => {
		const chunk = createChunk(0)
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)
		const internalUploader = uploader as unknown as {
			handleUploadError: (chunkId: string, error: Error) => Promise<void>
			activeUploadAttempts: Map<string, string>
			activeUploads: Map<string, StoredAudioChunk>
			activeUploadIds: Set<string>
		}
		internalUploader.activeUploadAttempts.set(chunk.id, "stale-attempt")
		internalUploader.activeUploadIds.add(chunk.id)

		await internalUploader.handleUploadError(chunk.id, new Error("upload failed"))

		expect(internalUploader.activeUploadAttempts.has(chunk.id)).toBe(false)
		expect(internalUploader.activeUploads.has(chunk.id)).toBe(false)
		expect(internalUploader.activeUploadIds.has(chunk.id)).toBe(false)
	})

	it("preserves SDK status and request identifiers on upload failures", async () => {
		const chunk = createChunk(0)
		testState.uploadBehaviors.push("fail")
		testState.uploadFailureError = Object.assign(new Error("task ended"), {
			status: 43202,
			requestId: "request-1",
		})

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
			},
			createBatchSaveReporter(),
		)
		const internalUploader = uploader as unknown as {
			sessionTopicMap: Map<string, string>
			sessionProjectMap: Map<string, string>
		}
		internalUploader.sessionTopicMap.set("session-1", "topic-1")
		internalUploader.sessionProjectMap.set("session-1", "project-1")

		await expect(uploader.uploadChunk(chunk)).rejects.toMatchObject({
			status: 43202,
			code: 43202,
			requestId: "request-1",
		})
	})

	it("uses the persisted MIME type when the Blob type is unavailable", async () => {
		const chunk = {
			...createChunk(0),
			chunk: new Blob([new Uint8Array([0])]),
		}
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("success")
		const batchSaveReporter = createBatchSaveReporter()
		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			batchSaveReporter,
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() =>
			expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalled(),
		)

		expect(testState.uploadCalls[0]).toMatchObject({ name: "0.wav", type: "audio/wav" })
		expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: "0.wav" }),
		)
	})

	it("uploads empty placeholders for failed chunks before marking them uploaded", async () => {
		const failedChunk = { ...createChunk(3), uploadStatus: "failed" as const }
		testState.chunks.set(failedChunk.id, failedChunk)
		testState.uploadBehaviors.push("success")
		const batchSaveReporter = createBatchSaveReporter()

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			batchSaveReporter,
		)

		const uploadedCount = await uploader.uploadEmptyPlaceholdersForFailedChunks(
			"session-1",
			"topic-1",
			"project-1",
		)

		expect(uploadedCount).toBe(1)
		expect(testState.uploadCalls).toEqual([
			{
				name: "3.wav",
				size: 44,
				type: "audio/wav",
			},
		])
		expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "session-1",
				projectId: "project-1",
				topicId: "sandbox-topic-1",
				taskId: "sandbox-task-1",
				fileName: "3.wav",
				fileSize: 44,
			}),
		)
		expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("uploaded")
	})

	it("uploads a valid Ogg/Opus placeholder for failed compressed chunks", async () => {
		const failedChunk: StoredAudioChunk = {
			...createChunk(9),
			chunk: new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53])], {
				type: "audio/ogg; codecs=opus",
			}),
			mimeType: "audio/ogg; codecs=opus",
			uploadStatus: "failed",
		}
		testState.chunks.set(failedChunk.id, failedChunk)
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 0,
			},
			createBatchSaveReporter(),
		)

		await expect(
			uploader.uploadEmptyPlaceholdersForFailedChunks("session-1", "topic-1", "project-1"),
		).resolves.toBe(1)

		expect(testState.uploadCalls[0]).toMatchObject({
			name: "9.opus",
			type: "audio/ogg",
		})
		expect(testState.uploadCalls[0].size).toBeGreaterThan(44)
		expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("uploaded")
	})

	it("maps Ogg/Opus MIME content to the backend .opus extension", async () => {
		const chunk: StoredAudioChunk = {
			...createChunk(7),
			chunk: new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53])], {
				type: "audio/ogg; codecs=opus",
			}),
			mimeType: "audio/ogg; codecs=opus",
		}
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 0,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		expect(testState.uploadCalls[0]).toMatchObject({
			name: "7.opus",
			type: "audio/ogg",
		})
	})

	it("uses the stored MIME type when IndexedDB clears Blob.type", async () => {
		const chunk: StoredAudioChunk = {
			...createChunk(8),
			chunk: new Blob([new Uint8Array([1, 2, 3])]),
			mimeType: "audio/wav",
		}
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 0,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		expect(testState.uploadCalls[0]).toMatchObject({
			name: "8.wav",
			type: "audio/wav",
		})
	})

	it("does not mark a chunk uploaded when backend batch save fails", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 0,
			},
			createBatchSaveReporter({
				reportUploadedFileStrict: vi.fn().mockRejectedValue(new Error("batch save failed")),
			}),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		await vi.runAllTicks()
		await Promise.resolve()

		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("failed")
	})

	it("rejects unsupported placeholder audio formats instead of uploading invalid empty files", async () => {
		const failedChunk = {
			...createChunk(4),
			chunk: new Blob([new Uint8Array([1])], { type: "audio/webm" }),
			mimeType: "audio/webm",
			uploadStatus: "failed" as const,
		}
		testState.chunks.set(failedChunk.id, failedChunk)

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)

		await expect(
			uploader.uploadEmptyPlaceholdersForFailedChunks("session-1", "topic-1", "project-1"),
		).rejects.toThrow("Unsupported placeholder audio format")
		expect(testState.uploadCalls).toHaveLength(0)
		expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("failed")
	})

	it("rejects placeholder compensation when failed chunk count exceeds the configured limit", async () => {
		for (let index = 0; index < 3; index++) {
			const failedChunk = { ...createChunk(index), uploadStatus: "failed" as const }
			testState.chunks.set(failedChunk.id, failedChunk)
		}

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)

		await expect(
			uploader.uploadEmptyPlaceholdersForFailedChunks("session-1", "topic-1", "project-1", {
				maxChunks: 2,
			}),
		).rejects.toThrow("Too many failed placeholder chunks")
		expect(testState.uploadCalls).toHaveLength(0)
	})

	it("aborts placeholder compensation before uploading more chunks", async () => {
		const failedChunk = { ...createChunk(5), uploadStatus: "failed" as const }
		testState.chunks.set(failedChunk.id, failedChunk)
		const abortController = new AbortController()
		abortController.abort()

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)

		await expect(
			uploader.uploadEmptyPlaceholdersForFailedChunks("session-1", "topic-1", "project-1", {
				signal: abortController.signal,
			}),
		).rejects.toThrow("cancelled")
		expect(testState.uploadCalls).toHaveLength(0)
		expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("failed")
	})

	it("applies an overall timeout to placeholder compensation", async () => {
		const failedChunk = { ...createChunk(6), uploadStatus: "failed" as const }
		testState.chunks.set(failedChunk.id, failedChunk)
		testState.uploadBehaviors.push("hang")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)

		const uploadPromise = uploader.uploadEmptyPlaceholdersForFailedChunks(
			"session-1",
			"topic-1",
			"project-1",
			{
				timeoutMs: 1_000,
			},
		)

		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))
		const expectation = expect(uploadPromise).rejects.toThrow("timed out")
		await vi.advanceTimersByTimeAsync(1_000)

		await expectation
		expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("failed")
	})

	it("limits concurrent placeholder uploads", async () => {
		for (let index = 0; index < 3; index++) {
			const failedChunk = { ...createChunk(index), uploadStatus: "failed" as const }
			testState.chunks.set(failedChunk.id, failedChunk)
			testState.uploadBehaviors.push("hang")
		}
		const abortController = new AbortController()

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 3,
				maxRetryCount: 1,
			},
			createBatchSaveReporter(),
		)

		const uploadPromise = uploader.uploadEmptyPlaceholdersForFailedChunks(
			"session-1",
			"topic-1",
			"project-1",
			{
				concurrency: 2,
				signal: abortController.signal,
			},
		)

		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(2))
		const expectation = expect(uploadPromise).rejects.toThrow("cancelled")
		abortController.abort()

		await expectation
		expect(testState.uploadCalls).toHaveLength(2)
	})

	it("marks pending IndexedDB chunks as stalled when they are not queued", async () => {
		testState.chunks.set("chunk-0", createChunk(0))
		testState.chunks.set("chunk-1", createChunk(1))

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		const health = await uploader.inspectQueueHealth("session-1")

		expect(health).toMatchObject({
			pending: 2,
			queuePending: 0,
			uploading: 0,
			failed: 0,
			stalled: true,
			reason: "pending_not_queued",
		})
	})

	it("resumes pending chunks that were left out of the upload queue", async () => {
		testState.chunks.set("chunk-0", createChunk(0))
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1")
		await vi.waitFor(() =>
			expect(testState.chunks.get("chunk-0")?.uploadStatus).toBe("uploaded"),
		)

		expect(testState.uploadCalls).toHaveLength(1)
		expect(
			testState.loggerReports.some(
				(args) =>
					(args[0] as { namespace?: string; data?: { event?: string } })?.namespace ===
						"recordingUploadLifecycle" &&
					(args[0] as { data?: { event?: string } })?.data?.event ===
						"session_pending_chunks_restored",
			),
		).toBe(true)
	})

	it("unblocks a stale active upload so pending chunks can continue", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)
		const internalUploader = uploader as unknown as {
			sessionActiveUploads: Map<string, string | null>
		}
		internalUploader.sessionActiveUploads.set("session-1", "ghost-chunk")

		const health = await uploader.inspectQueueHealth("session-1")
		expect(health).toMatchObject({
			stalled: true,
			reason: "stale_active_upload",
		})

		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1")
		await vi.waitFor(() =>
			expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("uploaded"),
		)
	})

	it("retries failed chunks when resuming a stalled session", async () => {
		const failedChunk = { ...createChunk(0), uploadStatus: "failed" as const }
		testState.chunks.set(failedChunk.id, failedChunk)
		testState.uploadBehaviors.push("success")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		const health = await uploader.inspectQueueHealth("session-1")
		expect(health).toMatchObject({
			stalled: true,
			reason: "has_failed",
		})

		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1")
		await vi.waitFor(() =>
			expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("uploaded"),
		)
	})

	it("does not cancel a healthy in-flight upload when resume is not forced", async () => {
		testState.chunks.set("chunk-0", createChunk(0))
		testState.uploadBehaviors.push("hang")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls.length).toBeGreaterThan(0))

		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1")

		expect(testState.uploadCancels[0]).not.toHaveBeenCalled()
	})

	it("reports a healthy queue while an upload is in flight", async () => {
		testState.chunks.set("chunk-0", createChunk(0))
		testState.uploadBehaviors.push("hang")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
			},
			createBatchSaveReporter(),
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls.length).toBeGreaterThan(0))

		const health = await uploader.inspectQueueHealth("session-1")
		expect(health).toMatchObject({
			stalled: false,
			reason: "healthy",
			uploading: 1,
		})
	})

	it("ignores a late success callback from a cancelled upload after force resume", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("hang", "success")
		const batchSaveReporter = createBatchSaveReporter()

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 3,
			},
			batchSaveReporter,
		)

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))

		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1", {
			force: true,
		})
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(2))

		testState.pendingUploads[0]?.success("uploaded/stale")
		await vi.runAllTicks()
		await Promise.resolve()
		await Promise.resolve()

		await vi.waitFor(() =>
			expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("uploaded"),
		)

		expect(testState.uploadCancels[0]).toHaveBeenCalledTimes(1)
		expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalledTimes(1)
		expect(batchSaveReporter.reportUploadedFileStrict).toHaveBeenCalledWith(
			expect.objectContaining({
				fileKey: "uploaded/2",
			}),
		)
	})

	it("ignores a late failure callback from a cancelled upload after force resume", async () => {
		const chunk = createChunk(0)
		testState.chunks.set(chunk.id, chunk)
		testState.uploadBehaviors.push("hang", "hang")

		const uploader = new ChunkUploader(
			{
				chunkSizeThreshold: 1,
				timeThreshold: 1,
				chunkCountThreshold: 1,
				maxConcurrentUploads: 1,
				maxRetryCount: 3,
			},
			createBatchSaveReporter(),
		)
		const internalUploader = uploader as unknown as {
			chunkRetries: Map<string, number>
			sessionQueues: Map<string, string[]>
			sessionActiveUploads: Map<string, string | null>
		}

		await uploader.uploadSession("session-1", "topic-1", "project-1")
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(1))

		await uploader.resumeStalledSessionUploads("session-1", "topic-1", "project-1", {
			force: true,
		})
		await vi.waitFor(() => expect(testState.uploadCalls).toHaveLength(2))

		testState.pendingUploads[0]?.fail(new Error("stale cancelled upload"))
		await vi.runAllTicks()
		await Promise.resolve()
		await Promise.resolve()

		expect(internalUploader.chunkRetries.get(chunk.id) ?? 0).toBe(0)
		expect(testState.chunks.get(chunk.id)?.uploadStatus).toBe("pending")
		expect(internalUploader.sessionActiveUploads.get("session-1")).toBe(chunk.id)
		expect(internalUploader.sessionQueues.get("session-1") ?? []).not.toContain(chunk.id)
	})
})
