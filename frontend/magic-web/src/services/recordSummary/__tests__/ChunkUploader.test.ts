import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoredAudioChunk, UploadStatus } from "../MediaRecorderService/AudioChunkDB"
import type { RecordingBatchSaveReporter } from "../RecordingBatchSaveReporter"
import { ChunkUploader } from "../ChunkUploader"

const testState = vi.hoisted(() => ({
	chunks: new Map<string, StoredAudioChunk>(),
	uploadBehaviors: [] as Array<"success" | "fail" | "hang">,
	uploadCalls: [] as Array<{ name: string; size: number; type: string }>,
}))

vi.mock("@/services/recordSummary/utils/RecordingLogger", () => {
	const logger = {
		log: vi.fn(),
		report: vi.fn(),
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
			return {
				success: (callback: (response: { data: { path: string } }) => void) => {
					if (behavior === "success") {
						queueMicrotask(() =>
							callback({
								data: { path: `uploaded/${testState.uploadCalls.length}` },
							}),
						)
					}
				},
				fail: (callback: (error: Error) => void) => {
					if (behavior === "fail") {
						queueMicrotask(() => callback(new Error("upload failed")))
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
		deletePendingSessionChunks: vi.fn(),
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
				topicId: "topic-1",
				fileName: "3.wav",
				fileSize: 44,
			}),
		)
		expect(testState.chunks.get(failedChunk.id)?.uploadStatus).toBe("uploaded")
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
})
