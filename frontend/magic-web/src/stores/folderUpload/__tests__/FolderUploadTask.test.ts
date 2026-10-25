import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { FolderUploadTask } from "../FolderUploadTask"
import type { TaskCallbacks, UploadResult } from "../types"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		batchSaveFiles: vi.fn(),
		createFile: vi.fn(),
	},
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			error: vi.fn(),
			log: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
		}),
	},
}))

vi.mock("../uploadService", () => ({
	ossUploadService: {
		uploadFiles: vi.fn(),
		cancelTaskUploads: vi.fn(),
		forceCleanupTask: vi.fn(),
		hasActiveUploadsForTask: vi.fn(() => false),
		pauseTaskUploads: vi.fn(),
		resumeTaskUploads: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
	},
}))

type FolderUploadTaskInternals = {
	id: string
	state: FolderUploadTask["state"]
	pendingSaveFiles: UploadResult[]
	pendingSavePromises: Set<Promise<void>>
	callbacks: TaskCallbacks
	fileKeyToRelativePath: Map<string, string>
	executePendingSave: () => Promise<void>
	finalizeRemainingFiles: () => Promise<void>
}

function createTask(): FolderUploadTaskInternals {
	const task = new FolderUploadTask(
		[new File(["image"], "image.png", { type: "image/png" })],
		"parent-id",
		{
			projectId: "project-id",
			projectName: "Project",
			t: (key) => key,
		},
	)
	return task as unknown as FolderUploadTaskInternals
}

function seedPendingSave(task: FolderUploadTaskInternals): void {
	task.pendingSaveFiles = [
		{
			file_key: "oss-key",
			file_name: "image.png",
			file_size: 5,
			file_extension: "png",
			relative_file_path: "images/image.png",
		},
	]
	task.fileKeyToRelativePath.set("oss-key", "image.png")
}

function mockSavedFiles(): void {
	vi.mocked(SuperMagicApi.batchSaveFiles).mockResolvedValueOnce([
		{
			file_id: "file-id",
			file_key: "oss-key",
			file_name: "image.png",
			file_size: 5,
			relative_file_path: "images/image.png",
		},
	])
}

describe("FolderUploadTask project save failures", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>
	let consoleLogSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
	})

	afterEach(() => {
		consoleErrorSpy.mockRestore()
		consoleLogSpy.mockRestore()
	})

	it("rejects callers when realtime project save fails", async () => {
		vi.mocked(SuperMagicApi.batchSaveFiles).mockRejectedValueOnce(new Error("save failed"))
		const task = createTask()
		const onError = vi.fn()
		const onComplete = vi.fn()
		task.callbacks = { onError, onComplete }
		seedPendingSave(task)

		await task.executePendingSave()

		expect(task.state.isError).toBe(true)
		expect(task.state.currentPhase).toBe("error")
		expect(task.state.errorMessage).toBe("save failed")
		expect(onError).toHaveBeenCalledOnce()
		expect(onError).toHaveBeenCalledWith(
			task.id,
			expect.objectContaining({ message: "save failed" }),
		)
		expect(onComplete).not.toHaveBeenCalled()
		expect(task.pendingSaveFiles).toEqual([])
	})

	it("rejects callers when final project save fails", async () => {
		vi.mocked(SuperMagicApi.batchSaveFiles).mockRejectedValueOnce(
			new Error("final save failed"),
		)
		const task = createTask()
		const onError = vi.fn()
		const onComplete = vi.fn()
		task.callbacks = { onError, onComplete }
		seedPendingSave(task)

		await task.finalizeRemainingFiles()

		expect(task.state.isError).toBe(true)
		expect(task.state.currentPhase).toBe("error")
		expect(task.state.errorMessage).toBe("final save failed")
		expect(onError).toHaveBeenCalledOnce()
		expect(onError).toHaveBeenCalledWith(
			task.id,
			expect.objectContaining({ message: "final save failed" }),
		)
		expect(onComplete).not.toHaveBeenCalled()
		expect(task.pendingSaveFiles).toEqual([])
	})

	it("keeps realtime save pending until async batch-save consumers settle", async () => {
		mockSavedFiles()
		const task = createTask()
		let settleConsumer!: () => void
		const consumerPromise = new Promise<void>((resolve) => {
			settleConsumer = resolve
		})
		const onBatchSaveComplete = vi.fn(() => consumerPromise)
		task.callbacks = { onBatchSaveComplete }
		seedPendingSave(task)

		let saveResolved = false
		const savePromise = task.executePendingSave().then(() => {
			saveResolved = true
		})

		await vi.waitFor(() => expect(onBatchSaveComplete).toHaveBeenCalledOnce())
		expect(saveResolved).toBe(false)

		settleConsumer()
		await savePromise
		expect(saveResolved).toBe(true)
	})

	it("keeps final save pending until async batch-save consumers settle", async () => {
		mockSavedFiles()
		const task = createTask()
		let settleConsumer!: () => void
		const consumerPromise = new Promise<void>((resolve) => {
			settleConsumer = resolve
		})
		const onBatchSaveComplete = vi.fn(() => consumerPromise)
		task.callbacks = { onBatchSaveComplete }
		seedPendingSave(task)

		let finalizeResolved = false
		const finalizePromise = task.finalizeRemainingFiles().then(() => {
			finalizeResolved = true
		})

		await vi.waitFor(() => expect(onBatchSaveComplete).toHaveBeenCalledOnce())
		expect(finalizeResolved).toBe(false)

		settleConsumer()
		await finalizePromise
		expect(finalizeResolved).toBe(true)
	})

	it("waits for an in-flight realtime save before finalizing", async () => {
		mockSavedFiles()
		const task = createTask()
		let settleConsumer!: () => void
		const consumerPromise = new Promise<void>((resolve) => {
			settleConsumer = resolve
		})
		const onBatchSaveComplete = vi.fn(() => consumerPromise)
		task.callbacks = { onBatchSaveComplete }
		seedPendingSave(task)

		const pendingSave = task.executePendingSave()
		task.pendingSavePromises.add(pendingSave)
		void pendingSave.finally(() => {
			task.pendingSavePromises.delete(pendingSave)
		})

		await vi.waitFor(() => expect(onBatchSaveComplete).toHaveBeenCalledOnce())

		let finalizeResolved = false
		const finalizePromise = task.finalizeRemainingFiles().then(() => {
			finalizeResolved = true
		})
		await Promise.resolve()
		expect(finalizeResolved).toBe(false)

		settleConsumer()
		await finalizePromise
		expect(finalizeResolved).toBe(true)
	})
})
