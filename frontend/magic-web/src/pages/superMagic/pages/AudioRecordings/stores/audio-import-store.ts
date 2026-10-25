import { makeAutoObservable, runInAction } from "mobx"
import i18next from "i18next"
import { ossUploadService } from "@/stores/folderUpload/uploadService"
import { audioRecordingsStore } from "./audio-recordings-store"
import { SuperMagicApi, FileApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { buildOptimisticRecordingItem } from "../utils/build-optimistic-recording-item"
import type { AudioProjectListItem } from "@/types/audioProject"
import { requestAudioRecordingsShellRefresh } from "../utils/request-audio-recordings-shell-refresh"
import { resolveImportedAudioDuration } from "../utils/imported-audio-duration"

const IMPORT_AUDIO_FILE_SYNC_RETRY_COUNT = 3
const IMPORT_AUDIO_FILE_SYNC_RETRY_DELAY_MS = 50

// Common audio extensions for validation
const COMMON_AUDIO_EXTENSIONS = [
	".raw",
	".wav",
	".mp3",
	".ogg",
	".opus",
	".webm",
	".m4a",
	".aac",
	".flac",
]
// Some video formats that commonly contain audio and are acceptable
const AUDIO_COMPATIBLE_VIDEO_EXTENSIONS = [".mp4", ".mov", ".3gp", ".mkv", ".avi"]

/**
 * Interface representing a single audio import task.
 */
export interface AudioImportTask {
	projectId: string
	projectName: string
	topicId: string
	workspaceId: string
	modelId: string
	taskKey: string
	autoSummaryEnabled: boolean
	progress: number // 0 to 1
	status: "transferring" | "done" | "failed"
	file: File
}

/**
 * Global MobX store managing the lifecycle of local audio file imports.
 * This store is a singleton that lives outside the React render tree,
 * ensuring uploads are not cancelled when switching pages in the SPA.
 */
export class AudioImportStore {
	// Active import tasks indexed by project ID
	importingTasks = new Map<string, AudioImportTask>()

	readonly MAX_UPLOAD_COUNT = 1
	readonly MAX_UPLOAD_SIZE = 500 * 1024 * 1024 // 500MB

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * Computes whether there is currently any uploading task.
	 */
	get hasUploadingTasks(): boolean {
		return Array.from(this.importingTasks.values()).some((t) => t.status === "transferring")
	}

	/**
	 * Retrieves the task associated with a specific project ID.
	 */
	getTask(projectId: string): AudioImportTask | undefined {
		return this.importingTasks.get(projectId)
	}

	/**
	 * Checks if a file is a likely audio file by its MIME type or extension.
	 */
	private isAudioOrVideoFile(file: File): boolean {
		if (file.type) {
			if (file.type.startsWith("audio/") || file.type === "video/webm") {
				return true
			}
		}

		const fileName = file.name.toLowerCase()
		const fileExtension = `.${fileName.split(".").pop()}`

		return (
			COMMON_AUDIO_EXTENSIONS.includes(fileExtension) ||
			AUDIO_COMPATIBLE_VIDEO_EXTENSIONS.includes(fileExtension)
		)
	}

	/**
	 * Validates files based on size, count and file type constraints.
	 * Returns true if validation passes, otherwise raises toast warnings and returns false.
	 */
	private validateFiles(files: File[]): boolean {
		// 1. Validate file count
		if (files.length === 0) {
			return false
		}
		if (files.length > this.MAX_UPLOAD_COUNT) {
			const errorMsg = i18next.t("fileUpload.maxFilesReached", {
				ns: "super",
				maxCount: this.MAX_UPLOAD_COUNT,
				defaultValue: `Cannot upload more than ${this.MAX_UPLOAD_COUNT} files`,
			})
			magicToast.error(errorMsg)
			return false
		}

		// 2. Validate file size and format for each file
		for (const file of files) {
			if (file.size > this.MAX_UPLOAD_SIZE) {
				const maxSizeMB = Math.round(this.MAX_UPLOAD_SIZE / (1024 * 1024))
				const errorMsg = i18next.t("recordingSummary.audioUpload.error.fileTooLarge", {
					ns: "super",
					maxSize: maxSizeMB,
					defaultValue: `File size exceeds ${maxSizeMB}MB limit`,
				})
				magicToast.error(errorMsg)
				return false
			}

			if (!this.isAudioOrVideoFile(file)) {
				const errorMsg = i18next.t("recordingSummary.audioUpload.error.notAudioFile", {
					ns: "super",
					defaultValue:
						"Selected file doesn't appear to be a valid audio file. Please select a valid audio file.",
				})
				magicToast.error(errorMsg)
				return false
			}
		}

		return true
	}

	/** Small async delay used while waiting for authoritative list hydration after import-files. */
	private async sleep(ms: number): Promise<void> {
		await new Promise((resolve) => {
			globalThis.setTimeout(resolve, ms)
		})
	}

	/** Reads the latest authoritative project row after the shell refresh handler repopulates the list store. */
	private findAuthoritativeImportedProject(projectId: string): AudioProjectListItem | null {
		return audioRecordingsStore.list.find((item) => item.id === projectId) ?? null
	}

	/** Imported auto-summary must wait until backend hydrates audio_file_id onto the authoritative project row. */
	private async waitForImportedProjectHydration(
		projectId: string,
	): Promise<AudioProjectListItem | null> {
		for (let attempt = 0; attempt < IMPORT_AUDIO_FILE_SYNC_RETRY_COUNT; attempt += 1) {
			requestAudioRecordingsShellRefresh()
			const hydratedProject = this.findAuthoritativeImportedProject(projectId)
			if (hydratedProject?.audio_file_id) return hydratedProject
			if (attempt < IMPORT_AUDIO_FILE_SYNC_RETRY_COUNT - 1) {
				await this.sleep(IMPORT_AUDIO_FILE_SYNC_RETRY_DELAY_MS)
			}
		}

		return null
	}

	/**
	 * Initiates the audio file import and upload process.
	 * Registers the task in MobX, delegates the upload to ossUploadService,
	 * and fires backend integration APIs upon completion.
	 */
	async startAudioImport(
		files: File[],
		context: {
			projectId: string
			projectName: string
			topicId: string
			workspaceId: string
			modelId: string
			taskKey: string
			autoSummaryEnabled: boolean
			onUploadStarted?: () => void
		},
	): Promise<void> {
		const {
			projectId,
			projectName,
			topicId,
			workspaceId,
			modelId,
			taskKey,
			autoSummaryEnabled,
		} = context

		// Perform client-side constraints validation
		if (!this.validateFiles(files)) {
			return
		}

		const targetFile = files[0]
		// Keep the import-only fallback logic inside the recordings domain instead of expanding shared audio utils.
		const importedDuration = await resolveImportedAudioDuration(targetFile)

		// Add new task to the local map
		runInAction(() => {
			this.importingTasks.set(projectId, {
				projectId,
				projectName,
				topicId,
				workspaceId,
				modelId,
				taskKey,
				autoSummaryEnabled,
				progress: 0,
				status: "transferring",
				file: targetFile,
			})
		})

		// Remind users not to hard-refresh while SPA navigation remains safe during upload.
		magicToast.info({
			content: i18next.t("import.doNotRefreshTip", {
				ns: "audioRecordings",
				defaultValue:
					"Please don't refresh until the import finishes. Switching to other pages won't interrupt it.",
			}),
			duration: 5000,
		})

		try {
			let didNotifyUploadStarted = false
			await ossUploadService.uploadFiles(
				[
					{
						file: targetFile,
						relativePath: targetFile.name,
						folderPath: "",
						targetPath: "",
					},
				],
				projectId,
				"", // Folder path not needed for private summary files
				projectId, // Use project ID as taskId for task-level management
				undefined,
				// onProgress handler
				(fileId, uploadedBytes) => {
					// A created upload task is not yet a started transfer. Report only after
					// OSS confirms that bytes are moving, and never more than once per import.
					if (!didNotifyUploadStarted && uploadedBytes > 0) {
						didNotifyUploadStarted = true
						try {
							context.onUploadStarted?.()
						} catch (error) {
							// Observability callbacks must never interrupt the user's upload.
							console.warn("Audio import start observer failed:", error)
						}
					}
					const progress = Math.min(uploadedBytes / targetFile.size, 0.99)
					runInAction(() => {
						const task = this.importingTasks.get(projectId)
						if (task) {
							task.progress = progress
						}
					})
					// Sync progress to the global list store optimistic item
					audioRecordingsStore.updateOptimisticItemTransfer(
						projectId,
						"transferring",
						progress,
					)
				},
				// onFileCompleted handler
				async (fileId, uploadResult) => {
					try {
						// 1. Report upload to obtain file key mapping
						await FileApi.reportFileUploads([
							{
								file_extension:
									uploadResult.file_extension ||
									uploadResult.file_name.split(".").pop() ||
									"",
								file_key: uploadResult.file_key,
								file_size: uploadResult.file_size,
								file_name: uploadResult.file_name,
							},
						])

						// 2. Import the uploaded object into the audio project so backend can hydrate audio_file_id.
						const importResponse = await SuperMagicApi.importAudioProjectFiles({
							project_id: projectId,
							parent_id: "",
							files: [
								{
									file_key: uploadResult.file_key,
									file_name: uploadResult.file_name,
									file_size: uploadResult.file_size,
									// Keep backend fallback compatibility by sending 0 only when metadata probing failed.
									duration: importedDuration,
								},
							],
						})
						// import-files returns the imported audio file ids directly. Use the first id
						// as the summary input immediately so auto-summary does not depend on list hydration timing.
						const importedAudioFileId = importResponse.file_ids[0]

						// 3. Seed a manual-summary-ready optimistic card first; it becomes
						// summarizing only after imported auto-summary successfully starts.
						const completedProject = buildOptimisticRecordingItem({
							projectId,
							projectName,
							workspaceId,
							modelId,
							audioFileId: importedAudioFileId,
							taskKey,
							audioSource: "imported",
							topicId,
							duration: importedDuration,
							autoSummaryEnabled: false,
						})
						completedProject.transferStatus = "done"

						// Push item to store; manual-summary stays here, while auto-summary upgrades
						// the same optimistic item through the shared store state machine below.
						audioRecordingsStore.addOptimisticItem(completedProject)

						if (!autoSummaryEnabled) {
							requestAudioRecordingsShellRefresh()
							runInAction(() => {
								this.importingTasks.delete(projectId)
							})
							return
						}

						// Prefer the synchronous import-files response; fall back to the refreshed authoritative
						// row only when backend does not include the file id in the immediate response.
						const summaryProject =
							importedAudioFileId != null && importedAudioFileId !== ""
								? {
										...completedProject,
										audio_file_id: importedAudioFileId,
									}
								: await this.waitForImportedProjectHydration(projectId)
						if (!summaryProject?.audio_file_id) {
							magicToast.error(
								i18next.t("audioRecordings:summary.missingParams", {
									defaultValue: "Missing imported audio file id",
								}),
							)
							runInAction(() => {
								this.importingTasks.delete(projectId)
							})
							return
						}

						// Route imported auto-summary through the same store state machine used by
						// manual summary so the list immediately flips to summarizing and registers polling.
						const summaryResult =
							await audioRecordingsStore.submitSummary(summaryProject)
						if (!summaryResult.ok) {
							if (summaryResult.reason === "missingParams") {
								magicToast.error(
									i18next.t("audioRecordings:summary.missingParams", {
										defaultValue: "Missing imported audio file id",
									}),
								)
							} else if (summaryResult.reason === "missingModel") {
								magicToast.error(
									i18next.t("audioRecordings:summary.missingModel", {
										defaultValue: "Missing summary model",
									}),
								)
							} else if (summaryResult.reason === "api") {
								magicToast.error(
									i18next.t("audioRecordings:summary.submitFailed", {
										defaultValue: "Failed to submit summary",
									}),
								)
							}
							runInAction(() => {
								this.importingTasks.delete(projectId)
							})
							return
						}

						runInAction(() => {
							this.importingTasks.delete(projectId)
						})
					} catch (error) {
						console.error("Failed to finalize audio project save or summary:", error)
						this.handleImportFailed(projectId)
					}
				},
			)
		} catch (error) {
			console.error("OSS Upload failed for audio project:", error)
			this.handleImportFailed(projectId)
		}
	}

	/**
	 * Retries a previously failed import task.
	 */
	async retryImport(projectId: string): Promise<void> {
		const task = this.importingTasks.get(projectId)
		if (!task) return

		// Reset progress and status on retry
		runInAction(() => {
			task.progress = 0
			task.status = "transferring"
		})
		audioRecordingsStore.updateOptimisticItemTransfer(projectId, "transferring", 0)

		await this.startAudioImport([task.file], {
			projectId: task.projectId,
			projectName: task.projectName,
			topicId: task.topicId,
			workspaceId: task.workspaceId,
			modelId: task.modelId,
			taskKey: task.taskKey,
			autoSummaryEnabled: task.autoSummaryEnabled,
		})
	}

	/**
	 * Cancels an ongoing upload task.
	 */
	cancelImport(projectId: string): void {
		const task = this.importingTasks.get(projectId)
		if (!task) return

		// Cancel task execution via the OSS upload service
		ossUploadService.cancelTaskUploads(projectId)

		runInAction(() => {
			this.importingTasks.delete(projectId)
		})
		audioRecordingsStore.clearOptimisticItem(projectId)
	}

	/**
	 * Clears the record of a task from the map.
	 */
	clearTask(projectId: string): void {
		runInAction(() => {
			this.importingTasks.delete(projectId)
		})
	}

	/**
	 * Handles failure states gracefully and updates stores.
	 */
	private handleImportFailed(projectId: string): void {
		runInAction(() => {
			const task = this.importingTasks.get(projectId)
			if (task) {
				task.status = "failed"
			}
		})
		audioRecordingsStore.updateOptimisticItemTransfer(projectId, "failed")
		const errorMsg = i18next.t("audioRecordings:summary.submitFailed", {
			defaultValue: "Failed to upload and submit summary",
		})
		magicToast.error(errorMsg)
	}
}

// Export singleton instance of the store
export const audioImportStore = new AudioImportStore()
