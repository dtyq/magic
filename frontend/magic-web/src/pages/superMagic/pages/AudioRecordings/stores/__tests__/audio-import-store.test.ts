import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AudioProjectListItem } from "@/types/audioProject"

const {
	uploadFilesMock,
	reportFileUploadsMock,
	importAudioProjectFilesMock,
	resolveImportedAudioDurationMock,
	requestShellRefreshMock,
	addOptimisticItemMock,
	updateOptimisticItemTransferMock,
	clearOptimisticItemMock,
	toastErrorMock,
	toastInfoMock,
	localStorageMock,
	storeSubmitSummaryMock,
} = vi.hoisted(() => ({
	uploadFilesMock: vi.fn(),
	reportFileUploadsMock: vi.fn(),
	importAudioProjectFilesMock: vi.fn(),
	resolveImportedAudioDurationMock: vi.fn(),
	requestShellRefreshMock: vi.fn(),
	addOptimisticItemMock: vi.fn(),
	updateOptimisticItemTransferMock: vi.fn(),
	clearOptimisticItemMock: vi.fn(),
	toastErrorMock: vi.fn(),
	toastInfoMock: vi.fn(),
	storeSubmitSummaryMock: vi.fn(),
	localStorageMock: {
		getItem: vi.fn(() => null),
		setItem: vi.fn(),
		removeItem: vi.fn(),
	},
}))

let authoritativeList: AudioProjectListItem[] = []

Object.defineProperty(globalThis, "localStorage", {
	value: localStorageMock,
	configurable: true,
})

vi.mock("@/stores/folderUpload/uploadService", () => ({
	ossUploadService: {
		uploadFiles: uploadFilesMock,
		cancelTaskUploads: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	FileApi: {
		reportFileUploads: reportFileUploadsMock,
	},
	SuperMagicApi: {
		importAudioProjectFiles: importAudioProjectFilesMock,
	},
}))

vi.mock("../../utils/imported-audio-duration", () => ({
	resolveImportedAudioDuration: resolveImportedAudioDurationMock,
}))

vi.mock("../audio-recordings-store", () => ({
	audioRecordingsStore: {
		get list() {
			return authoritativeList
		},
		submitSummary: storeSubmitSummaryMock,
		addOptimisticItem: addOptimisticItemMock,
		updateOptimisticItemTransfer: updateOptimisticItemTransferMock,
		clearOptimisticItem: clearOptimisticItemMock,
	},
}))

vi.mock("../../utils/request-audio-recordings-shell-refresh", () => ({
	requestAudioRecordingsShellRefresh: requestShellRefreshMock,
}))

vi.mock("../../hooks/useRecordingSettings", () => ({
	getCachedRecordingSettings: vi.fn(() => null),
}))

vi.mock("../../apis/recording-settings-api", () => ({
	getRecordingTopicModel: vi.fn(),
}))

vi.mock("../../utils/recording-settings-mapper", () => ({
	resolveAutoSummaryEnabled: vi.fn(() => true),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: toastErrorMock,
		info: toastInfoMock,
	},
}))

describe("AudioImportStore", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
		authoritativeList = []
		uploadFilesMock.mockImplementation(
			async (_files, _projectId, _folderPath, _taskId, _unused, _onProgress, onCompleted) => {
				await onCompleted("upload-1", {
					file_extension: "wav",
					file_key: "recording/imported.wav",
					file_name: "imported.wav",
					file_size: 256,
				})
			},
		)
		reportFileUploadsMock.mockResolvedValue(undefined)
		importAudioProjectFilesMock.mockResolvedValue({ file_ids: ["imported-file-id"], total: 1 })
		resolveImportedAudioDurationMock.mockResolvedValue(64)
		storeSubmitSummaryMock.mockResolvedValue({ ok: true })
		requestShellRefreshMock.mockImplementation(() => {
			authoritativeList = [
				{
					id: "project-import",
					project_name: "Imported Project",
					created_at: 1780657155,
					duration: 256,
					tags: [],
					device_id: "",
					audio_source: "imported",
					current_phase: "merging",
					phase_status: "completed",
					card_status: "not_summarized",
					is_summarized: false,
					workspace_id: "workspace-import",
					workspace_name: null,
					model_id: "model-alpha",
					audio_file_id: "hydrated-audio-file-id",
					task_key: "session-web-imported",
					topic_id: "topic-import",
					source: "pc",
				},
			]
		})
	})

	it("uses import-files then auto submits imported audio after refresh hydrates audio_file_id", async () => {
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "imported.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
		})

		expect(reportFileUploadsMock).toHaveBeenCalledWith([
			expect.objectContaining({
				file_key: "recording/imported.wav",
				file_name: "imported.wav",
			}),
		])
		expect(importAudioProjectFilesMock).toHaveBeenCalledWith({
			project_id: "project-import",
			parent_id: "",
			files: [
				expect.objectContaining({
					file_key: "recording/imported.wav",
					file_name: "imported.wav",
					file_size: 256,
					duration: 64,
				}),
			],
		})
		expect(requestShellRefreshMock).not.toHaveBeenCalled()
		expect(storeSubmitSummaryMock).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "project-import",
				audio_source: "imported",
				audio_file_id: "imported-file-id",
				task_key: "session-web-imported",
			}),
		)
		expect(toastInfoMock).toHaveBeenCalledTimes(1)
		expect(toastInfoMock).toHaveBeenCalledWith(
			expect.objectContaining({
				duration: 5000,
			}),
		)
	})

	it("does not show the do-not-refresh tip when file validation fails", async () => {
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()
		const oversizedFile = new File([new Uint8Array(1)], "huge.wav", { type: "audio/wav" })
		Object.defineProperty(oversizedFile, "size", { value: store.MAX_UPLOAD_SIZE + 1 })

		await store.startAudioImport([oversizedFile], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
		})

		expect(toastInfoMock).not.toHaveBeenCalled()
		expect(uploadFilesMock).not.toHaveBeenCalled()
		expect(toastErrorMock).toHaveBeenCalled()
	})

	it("accepts an Opus recording artifact when the browser omits its MIME type", async () => {
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["mock-audio"], "mock-recording.opus")], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: false,
		})

		expect(uploadFilesMock).toHaveBeenCalledTimes(1)
		expect(toastErrorMock).not.toHaveBeenCalled()
	})

	it("stops after import-files when imported auto summary is disabled", async () => {
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "manual.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: false,
		})

		expect(importAudioProjectFilesMock).toHaveBeenCalledTimes(1)
		expect(requestShellRefreshMock).toHaveBeenCalledTimes(1)
		expect(storeSubmitSummaryMock).not.toHaveBeenCalled()
		expect(addOptimisticItemMock).toHaveBeenCalledWith(
			expect.objectContaining({
				audio_source: "imported",
				duration: 64,
				current_phase: "merging",
				phase_status: "completed",
				card_status: "not_summarized",
			}),
		)
	})

	it("auto summarizes from import-files file_ids even when refresh does not hydrate audio_file_id", async () => {
		requestShellRefreshMock.mockImplementation(() => {
			authoritativeList = []
		})

		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "stalled.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
		})

		expect(importAudioProjectFilesMock).toHaveBeenCalledTimes(1)
		expect(storeSubmitSummaryMock).toHaveBeenCalledWith(
			expect.objectContaining({
				audio_source: "imported",
				audio_file_id: "imported-file-id",
			}),
		)
		expect(toastErrorMock).not.toHaveBeenCalled()
	})

	it("does not refresh list immediately after imported auto summary starts", async () => {
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "ordered.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
		})

		expect(storeSubmitSummaryMock).toHaveBeenCalledTimes(1)
		expect(requestShellRefreshMock).not.toHaveBeenCalled()
	})

	it("falls back to duration 0 when metadata parsing fails", async () => {
		resolveImportedAudioDurationMock.mockResolvedValue(0)

		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "broken.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: false,
		})

		expect(importAudioProjectFilesMock).toHaveBeenCalledWith({
			project_id: "project-import",
			parent_id: "",
			files: [
				expect.objectContaining({
					file_name: "imported.wav",
					duration: 0,
				}),
			],
		})
		expect(addOptimisticItemMock).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }))
	})

	it("falls back to duration 0 when metadata parsing throws unexpectedly", async () => {
		resolveImportedAudioDurationMock.mockResolvedValue(0)

		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "timeout.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: false,
		})

		expect(importAudioProjectFilesMock).toHaveBeenCalledWith({
			project_id: "project-import",
			parent_id: "",
			files: [
				expect.objectContaining({
					file_name: "imported.wav",
					duration: 0,
				}),
			],
		})
	})

	it("notifies onUploadStarted only after upload progress confirms transferred bytes", async () => {
		let resolveUpload: (value?: unknown) => void = () => undefined
		let reportProgress: ((fileId: string, uploadedBytes: number) => void) | undefined
		uploadFilesMock.mockImplementation(
			(_files, _projectId, _folderPath, _taskId, _unused, onProgress) =>
				new Promise((resolve) => {
					resolveUpload = resolve
					reportProgress = onProgress
				}),
		)
		const onUploadStarted = vi.fn()
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		const startPromise = store.startAudioImport(
			[new File(["voice"], "imported.wav", { type: "audio/wav" })],
			{
				projectId: "project-import",
				projectName: "Imported Project",
				topicId: "topic-import",
				workspaceId: "workspace-import",
				modelId: "model-alpha",
				taskKey: "session-web-imported",
				autoSummaryEnabled: true,
				onUploadStarted,
			},
		)

		await vi.waitFor(() => {
			expect(uploadFilesMock).toHaveBeenCalledTimes(1)
		})
		expect(onUploadStarted).not.toHaveBeenCalled()
		reportProgress?.("upload-1", 0)
		expect(onUploadStarted).not.toHaveBeenCalled()
		reportProgress?.("upload-1", 1)
		expect(onUploadStarted).toHaveBeenCalledTimes(1)
		reportProgress?.("upload-1", 2)
		expect(onUploadStarted).toHaveBeenCalledTimes(1)
		expect(reportFileUploadsMock).not.toHaveBeenCalled()

		resolveUpload()
		await startPromise
	})

	it("does not notify onUploadStarted when client-side validation fails", async () => {
		const onUploadStarted = vi.fn()
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()
		const oversizedFile = new File([new Uint8Array(1)], "huge.wav", { type: "audio/wav" })
		Object.defineProperty(oversizedFile, "size", { value: store.MAX_UPLOAD_SIZE + 1 })

		await store.startAudioImport([oversizedFile], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
			onUploadStarted,
		})

		expect(onUploadStarted).not.toHaveBeenCalled()
		expect(uploadFilesMock).not.toHaveBeenCalled()
	})

	it("does not notify onUploadStarted when uploadFiles throws before returning a promise", async () => {
		uploadFilesMock.mockImplementation(() => {
			throw new Error("oss unavailable")
		})
		const onUploadStarted = vi.fn()
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "imported.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
			onUploadStarted,
		})

		expect(onUploadStarted).not.toHaveBeenCalled()
	})

	it("keeps the upload running when onUploadStarted throws", async () => {
		uploadFilesMock.mockImplementation(
			async (_files, _projectId, _folderPath, _taskId, _unused, onProgress, onCompleted) => {
				onProgress("upload-1", 1)
				await onCompleted("upload-1", {
					file_extension: "wav",
					file_key: "recording/imported.wav",
					file_name: "imported.wav",
					file_size: 256,
				})
			},
		)
		const onUploadStarted = vi.fn(() => {
			throw new Error("observer failed")
		})
		const { AudioImportStore } = await import("../audio-import-store")
		const store = new AudioImportStore()

		await store.startAudioImport([new File(["voice"], "imported.wav", { type: "audio/wav" })], {
			projectId: "project-import",
			projectName: "Imported Project",
			topicId: "topic-import",
			workspaceId: "workspace-import",
			modelId: "model-alpha",
			taskKey: "session-web-imported",
			autoSummaryEnabled: true,
			onUploadStarted,
		})

		expect(onUploadStarted).toHaveBeenCalledTimes(1)
		expect(importAudioProjectFilesMock).toHaveBeenCalledTimes(1)
	})
})
