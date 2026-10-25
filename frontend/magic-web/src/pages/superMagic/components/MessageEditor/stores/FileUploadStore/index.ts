import { makeAutoObservable } from "mobx"
import { t } from "i18next"
import { logger as Logger } from "@/infrastructure/logger"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { UploadMentionItem } from "@/components/business/MentionPanel/runtime/builtin/domains/upload-files"
import projectFilesStore, { type ProjectFilesStore } from "@/stores/projectFiles"
import magicToast from "@/components/base/MagicToaster/utils"
import { SuperMagicApi } from "@/apis"
import type { ProjectAttachmentsV2NextParentState } from "@/apis/modules/superMagic"
import { generateUniqueFileName } from "../../utils/generateUniqueFileName"
import {
	superMagicUploadTokenService,
	type UploadTokenService,
} from "../../services/UploadTokenService"
import { UploadService } from "../../services/UploadService"
import type { FileData } from "../../types"
import { UploadSource } from "../../types"
import {
	validateDuplicateFiles,
	validateFileCount,
	validateFileSize,
	validateEmptyFiles,
} from "./validators"
import { createUploadHandlers } from "./uploadHandlers"
import {
	createPastedProjectFileReferences,
	createPastedUploadFileReferences,
} from "./pastedFileReferences"

const TEMP_UPLOAD_DIR_NAME = ".tmp"
const MAX_TEMP_DIRECTORY_ATTACHMENT_PAGES = 100

export interface AddFilesOptions {
	/** 单次导入覆盖默认的末尾插入；sourceFiles 保留改名前的对象身份，与 files 一一对应。 */
	onFileAdded?: (files: FileData[], sourceFiles: File[]) => void
	/** 异步准备期间离开原话题或清空输入后，不再向新的编辑上下文添加文件。 */
	isCurrent?: () => boolean
	/** Upload directly into the hidden project temp directory. */
	useTempDirectory?: boolean
	/** @deprecated Use useTempDirectory. Kept for consumer compatibility. */
	usePastedTextTempDirectory?: boolean
	defaultRelativePathPrefix?: string
	/** Keep the resulting attachment as an upload mention instead of a project mention. */
	isCanvasClipboard?: boolean
}

export interface FileUploadStoreOptions {
	/** Independent blank composers must not upload into the same temporary project directory. */
	uploadTokenService?: UploadTokenService
	maxUploadCount?: number
	maxUploadSize?: number
	projectId?: string
	topicId?: string
	onFileUpload?: (files: FileData[]) => void
	onFileAdded?: (files: FileData[]) => void
	onFileProgressUpdate?: (
		fileId: string,
		progress: number,
		status: FileData["status"],
		error?: string,
	) => void
	onFileCompleted?: (
		fileId: string,
		reportResult: FileData["reportResult"],
		saveResult: FileData["saveResult"],
	) => void
	onFileRemoved?: (fileId: string) => void
	storageType?: "workspace" | "topic"
	source?: UploadSource
	needFilterSameFile?: boolean
	onChange?: (files: FileData[]) => void
	projectFilesStore?: ProjectFilesStore
}

const logger = Logger.createLogger("SuperMagicUpload")

export class FileUploadStore {
	getTemporaryWorkdir() {
		return this.uploadTokenService.getLastWorkDir()
	}

	files: FileData[] = []
	uploading = false
	maxUploadCount = 20
	maxUploadSize = 1024 * 1024 * 100
	projectId = ""
	topicId = ""
	needFilterSameFile = true
	storageType: "workspace" | "topic" = "workspace"
	source?: UploadSource

	onFileUpload?: (files: FileData[]) => void
	onFileAdded?: (files: FileData[]) => void
	onFileProgressUpdate?: (
		fileId: string,
		progress: number,
		status: FileData["status"],
		error?: string,
	) => void
	onFileCompleted?: (
		fileId: string,
		reportResult: FileData["reportResult"],
		saveResult: FileData["saveResult"],
	) => void
	onFileRemoved?: (fileId: string) => void
	onChange?: (files: FileData[]) => void

	private uploadService = new UploadService<FileData>()
	private uploadHandlers!: ReturnType<typeof createUploadHandlers>
	private sessionUploadFileIds = new Set<string>()
	private sessionSavedProjectFileIds = new Set<string>()
	private tempUploadDirectoryIds = new Map<string, string>()
	private projectFilesStore: ProjectFilesStore
	private uploadTokenService: UploadTokenService

	constructor(options: FileUploadStoreOptions = {}) {
		this.projectFilesStore = options.projectFilesStore ?? projectFilesStore
		this.uploadTokenService = options.uploadTokenService ?? superMagicUploadTokenService
		makeAutoObservable<FileUploadStore, "uploadTokenService">(
			this,
			{
				uploadTokenService: false,
				// Node views call this during render and must track the observable file fields.
				getFileById: false,
			},
			{
				autoBind: true,
			},
		)
		this.uploadHandlers = createUploadHandlers({
			getProjectId: () => this.projectId,
			getTopicId: () => this.topicId,
			getStorageType: () => this.storageType,
			getSource: () => this.source,
			getProjectFilesStore: () => this.projectFilesStore,
			getFiles: () => this.files,
			trackSavedProjectFileId: (fileId) => this.trackSavedProjectFileId(fileId),
			setFilesWithLimit: (updater) => this.setFilesWithLimit(updater),
			onProgressFilesChanged: (files) => {
				this.onFileUpload?.(files)
				this.onChange?.(files)
			},
			onFileProgressUpdate: (...args) => this.onFileProgressUpdate?.(...args),
			onFileCompleted: (...args) => this.onFileCompleted?.(...args),
		})
		this.updateOptions(options)
	}

	updateOptions(options: FileUploadStoreOptions = {}) {
		if ("maxUploadCount" in options && options.maxUploadCount !== undefined)
			this.maxUploadCount = options.maxUploadCount
		if ("maxUploadSize" in options && options.maxUploadSize !== undefined)
			this.maxUploadSize = options.maxUploadSize
		if ("projectId" in options) this.projectId = options.projectId ?? ""
		if ("topicId" in options) this.topicId = options.topicId ?? ""
		if ("storageType" in options && options.storageType) this.storageType = options.storageType
		if ("source" in options) this.source = options.source
		if ("needFilterSameFile" in options && options.needFilterSameFile !== undefined)
			this.needFilterSameFile = options.needFilterSameFile
		if ("projectFilesStore" in options && options.projectFilesStore)
			this.projectFilesStore = options.projectFilesStore

		if ("onFileUpload" in options) this.onFileUpload = options.onFileUpload
		if ("onFileAdded" in options) this.onFileAdded = options.onFileAdded
		if ("onFileProgressUpdate" in options)
			this.onFileProgressUpdate = options.onFileProgressUpdate
		if ("onFileCompleted" in options) this.onFileCompleted = options.onFileCompleted
		if ("onFileRemoved" in options) this.onFileRemoved = options.onFileRemoved
		if ("onChange" in options) this.onChange = options.onChange
	}

	get isAllFilesUploaded() {
		return this.files.length === 0 || this.files.every((file) => file.status === "done")
	}

	/** Marker node views reuse the editor-scoped attachment store for preview URL resolution. */
	getProjectFilesStore(): ProjectFilesStore {
		return this.projectFilesStore
	}

	getFileById(fileId: string): FileData | undefined {
		return this.files.find((file) => file.id === fileId)
	}

	isCurrentSessionUploadFile(fileId: string) {
		return this.sessionUploadFileIds.has(fileId)
	}

	isCurrentSessionProjectFile(fileId: string) {
		return this.sessionSavedProjectFileIds.has(fileId)
	}

	getUploadMentionItems(): UploadMentionItem[] {
		return this.files.flatMap((file) => {
			const filePath = file.reportResult?.file_key ?? file.result?.key
			if (!filePath) return []

			const fileId = file.reportResult?.file_id || file.id
			const fileName = file.reportResult?.file_name || file.result?.name || file.name
			const fileExtension = fileName.split(".").pop() ?? ""

			return [
				{
					id: fileId,
					type: MentionItemType.UPLOAD_FILE,
					name: fileName,
					icon: fileExtension,
					extension: fileExtension,
					hasChildren: false,
					data: {
						file_id: fileId,
						file_name: fileName,
						file_path: filePath,
						relative_file_path:
							file.saveResult?.relative_file_path || file.defaultRelativePath,
						is_hidden: file.saveResult?.is_hidden ?? file.isHidden,
						file_extension: fileExtension,
						file_size:
							file.reportResult?.file_size ?? file.result?.size ?? file.file.size,
						file: file.file,
						upload_progress: file.progress,
						upload_status: file.status,
						upload_error: file.error,
						is_canvas_clipboard: file.isCanvasClipboard,
					},
				},
			]
		})
	}

	private setFilesWithLimit(newFiles: FileData[] | ((prev: FileData[]) => FileData[])) {
		const fileList = typeof newFiles === "function" ? newFiles(this.files) : newFiles
		const limitedFiles = fileList.slice(0, this.maxUploadCount)

		if (fileList.length > this.maxUploadCount) {
			magicToast.error(
				t("fileUpload.maxFilesReached", { ns: "super", maxCount: this.maxUploadCount }),
			)
		}

		this.files = limitedFiles

		this.onFileUpload?.(limitedFiles)
		this.onChange?.(limitedFiles)
	}

	private setUploading(isUploading: boolean) {
		this.uploading = isUploading
	}

	private trackSessionUploads(fileDataList: FileData[]) {
		fileDataList.forEach((file) => {
			this.sessionUploadFileIds.add(file.id)
		})
	}

	private trackSavedProjectFileId(fileId?: string) {
		if (!fileId) return
		this.sessionSavedProjectFileIds.add(fileId)
	}

	private clearTrackedFileIds(file?: FileData) {
		if (!file) return
		this.sessionUploadFileIds.delete(file.id)
		if (file.reportResult?.file_id) {
			this.sessionSavedProjectFileIds.delete(file.reportResult.file_id)
		}
		if (file.saveResult?.file_id) {
			this.sessionSavedProjectFileIds.delete(file.saveResult.file_id)
		}
	}

	private clearTrackedFileIdsByProjectFileId(fileId: string) {
		this.sessionSavedProjectFileIds.delete(fileId)
		const matchedFiles = this.files.filter(
			(file) => file.reportResult?.file_id === fileId || file.saveResult?.file_id === fileId,
		)
		matchedFiles.forEach((file) => {
			this.sessionUploadFileIds.delete(file.id)
		})
	}

	private findRootDirectoryByName(directoryName: string) {
		return this.projectFilesStore.workspaceFilesList.find(
			(file) =>
				file.type === "directory" &&
				file.file_name === directoryName &&
				(file.parent_id === undefined || file.parent_id === ""),
		)
	}

	private async ensureTempUploadDirectory() {
		if (!this.projectId) return undefined

		const cachedDirectoryId = this.tempUploadDirectoryIds.get(this.projectId)
		if (cachedDirectoryId) return cachedDirectoryId

		const existingDirectory = this.findRootDirectoryByName(TEMP_UPLOAD_DIR_NAME)
		if (existingDirectory?.file_id) {
			this.tempUploadDirectoryIds.set(this.projectId, existingDirectory.file_id)
			return existingDirectory.file_id
		}

		const response = await SuperMagicApi.createFile({
			project_id: this.projectId,
			file_name: TEMP_UPLOAD_DIR_NAME,
			is_directory: true,
			ignore_duplicate: true,
		})

		if (response?.file_id) {
			this.tempUploadDirectoryIds.set(this.projectId, response.file_id)
			return response.file_id
		}

		logger.warn("create temp upload directory returned no file_id", {
			projectId: this.projectId,
			response,
		})

		return undefined
	}

	private async getTempDirectoryFileNames(parentId: string) {
		const fileNames: string[] = []
		let nextParentIds: ProjectAttachmentsV2NextParentState[] | undefined
		const seenPageStates = new Set<string>()

		for (let pageIndex = 0; pageIndex < MAX_TEMP_DIRECTORY_ATTACHMENT_PAGES; pageIndex += 1) {
			const response = await SuperMagicApi.getProjectAttachmentsV2Page({
				projectId: this.projectId,
				parentId,
				nextParentIds,
				pageSize: 1000,
				fileType: [
					"user_upload",
					"user_create",
					"process",
					"system_auto_upload",
					"directory",
				],
			})

			for (const item of response.list ?? []) {
				if (item.is_directory || item.type === "directory") continue
				if (String(item.parent_id ?? "") !== String(parentId)) continue
				const fileName = item.file_name || item.filename || item.name
				if (fileName) fileNames.push(fileName)
			}

			if (!response.has_more) return fileNames
			if (!response.next_parent_ids?.length) {
				throw new Error("empty temp directory attachment page cursor")
			}
			const stateKey = response.next_parent_ids
				.map(
					(state) =>
						`${state.parent_id}:${state.after_sort ?? ""}:${state.after_file_id ?? ""}`,
				)
				.join("|")
			if (seenPageStates.has(stateKey)) {
				throw new Error("repeated temp directory attachment page cursor")
			}
			seenPageStates.add(stateKey)
			nextParentIds = response.next_parent_ids
		}

		throw new Error("temp directory attachment pages exceeded limit")
	}

	private buildUploadParams(
		fileList: FileData[],
		customCredentials?: Parameters<UploadService<FileData>["upload"]>[0]["customCredentials"],
		customOption?: Parameters<UploadService<FileData>["upload"]>[0]["customOption"],
	) {
		return {
			fileList,
			customCredentials,
			customOption,
			url: this.uploadTokenService.getUploadTokenUrl,
			body: {
				project_id: this.projectId,
				expires: 3600,
			},
			rewriteFileName: false,
			onUploadStateChange: this.setUploading,
			onProgress: this.uploadHandlers.handleProgress,
			onSuccess: this.uploadHandlers.handleSuccess,
			onFail: this.uploadHandlers.handleFail,
			onInit: this.uploadHandlers.handleInit,
		}
	}

	validateDuplicateFiles(newFiles: File[], targetParentId: string | undefined) {
		return validateDuplicateFiles({
			newFiles,
			existingFiles: this.files,
			targetParentId,
			needFilterSameFile: this.needFilterSameFile,
			t,
			logger,
		})
	}

	validateFileSize(files: File[]) {
		return validateFileSize({ files, maxUploadSize: this.maxUploadSize, t, logger })
	}

	validateFileCount(filesToValidate: File[]) {
		return validateFileCount({
			filesToValidate,
			currentCount: this.files.length,
			maxUploadCount: this.maxUploadCount,
			t,
			logger,
		})
	}

	validateEmptyFiles(files: File[]) {
		return validateEmptyFiles(files, logger)
	}

	async addFiles(newFiles: File[], parentId?: string, options: AddFilesOptions | string = {}) {
		const addFilesOptions =
			typeof options === "string" ? { defaultRelativePathPrefix: options } : options
		if (addFilesOptions.isCurrent?.() === false) return
		const shouldUseTempDirectory = Boolean(
			addFilesOptions.useTempDirectory || addFilesOptions.usePastedTextTempDirectory,
		)
		const shouldRequestTempDirectory = shouldUseTempDirectory && Boolean(this.projectId)
		const tempDirectoryId = shouldRequestTempDirectory
			? await this.ensureTempUploadDirectory()
			: undefined
		if (addFilesOptions.isCurrent?.() === false) return
		const defaultRelativePathPrefix = shouldUseTempDirectory
			? TEMP_UPLOAD_DIR_NAME
			: addFilesOptions.defaultRelativePathPrefix
		const targetParentId = tempDirectoryId ?? parentId

		// Temp assets may intentionally be uploaded more than once; filename generation
		// below handles collisions without silently dropping an identical image.
		const duplicateValidation = shouldUseTempDirectory
			? { validFiles: newFiles, hasWarning: false }
			: this.validateDuplicateFiles(newFiles, targetParentId)
		let validFiles = duplicateValidation.validFiles

		const sizeValidation = this.validateFileSize(validFiles)
		validFiles = sizeValidation.validFiles

		const countValidation = this.validateFileCount(validFiles)
		validFiles = countValidation.validFiles

		if (!this.validateEmptyFiles(validFiles)) {
			return
		}

		let fileDataList: FileData[] = []
		const processedNames: string[] = this.files
			.filter((f) => f.parentId === targetParentId)
			.map((f) => f.name)

		for (const file of validFiles) {
			const uniqueFileName = generateUniqueFileName(
				file.name,
				this.files,
				processedNames,
				targetParentId,
			)
			processedNames.push(uniqueFileName)

			const renamedFile =
				uniqueFileName !== file.name
					? new File([file], uniqueFileName, {
							type: file.type,
							lastModified: file.lastModified,
						})
					: file

			fileDataList.push({
				id: `${Date.now()}-${Math.random()}`,
				name: uniqueFileName,
				file: renamedFile,
				status: "init",
				parentId: targetParentId,
				defaultRelativePath: defaultRelativePathPrefix
					? `${defaultRelativePathPrefix}/${uniqueFileName}`
					: undefined,
				isHidden: shouldUseTempDirectory,
				isCanvasClipboard: addFilesOptions.isCanvasClipboard,
			})
		}

		let customCredentials = await this.uploadTokenService.getUploadToken(
			this.projectId,
			targetParentId,
		)
		if (addFilesOptions.isCurrent?.() === false) return

		if (tempDirectoryId && customCredentials) {
			customCredentials = this.uploadTokenService.changeDir(
				customCredentials,
				TEMP_UPLOAD_DIR_NAME,
			)
		}

		if (this.projectId && customCredentials) {
			const projectFileNames = tempDirectoryId
				? await this.getTempDirectoryFileNames(tempDirectoryId)
				: this.projectFilesStore.getFileNamesInFolder(
						customCredentials.temporary_credential.dir,
					)

			const existingFileNamesInSameDir = this.files
				.filter((f) => f.parentId === targetParentId)
				.map((f) => f.name)
			const processedFileNames: string[] = existingFileNamesInSameDir.concat(projectFileNames)

			fileDataList = fileDataList.map((fileData) => {
				const finalFileName = generateUniqueFileName(
					fileData.name,
					this.files,
					processedFileNames,
					targetParentId,
				)
				processedFileNames.push(finalFileName)

				if (finalFileName !== fileData.name) {
					const finalRenamedFile = new File([fileData.file], finalFileName, {
						type: fileData.file.type,
						lastModified: fileData.file.lastModified,
					})

					return {
						...fileData,
						name: finalFileName,
						file: finalRenamedFile,
						parentId: targetParentId,
						defaultRelativePath: defaultRelativePathPrefix
							? `${defaultRelativePathPrefix}/${finalFileName}`
							: undefined,
					}
				}

				return fileData
			})
		}

		if (addFilesOptions.isCurrent?.() === false) return
		this.trackSessionUploads(fileDataList)

		this.setFilesWithLimit((prev) => {
			const newList = [...prev, ...fileDataList]
			if (addFilesOptions.onFileAdded) {
				addFilesOptions.onFileAdded(fileDataList, validFiles)
			} else {
				this.onFileAdded?.(fileDataList)
			}
			return newList
		})

		this.uploadService
			.upload(this.buildUploadParams(fileDataList, customCredentials))
			.then(async (res) => {
				if (res.rejected.length > 0 && this.projectId) {
					const hasExpired = res.rejected.filter((item) =>
						item.reason?.message?.includes("expired"),
					)
					if (hasExpired.length > 0) {
						logger.warn("upload credentials expired, refreshing and retrying", {
							expiredCount: hasExpired.length,
						})
						await this.uploadTokenService.fetchUploadToken(this.projectId)
					}

					const newCustomCredentials = await this.uploadTokenService.getUploadToken(
						this.projectId,
						targetParentId,
						true,
					)
					const retryCustomCredentials = tempDirectoryId
						? this.uploadTokenService.changeDir(
								newCustomCredentials,
								TEMP_UPLOAD_DIR_NAME,
							)
						: newCustomCredentials

					const newFileDataList = fileDataList
						.map((file) => {
							const target = res.rejected.find(
								(item) => item.reason?.uploadFile?.id === file.id,
							)
							if (target) {
								return {
									...file,
									reportResult: undefined,
									saveResult: undefined,
									error: target.reason?.message,
								}
							}
							return undefined
						})
						.filter(Boolean) as FileData[]

					if (newFileDataList.length > 0) {
						logger.warn("retrying failed uploads", { count: newFileDataList.length })
						this.uploadService
							.upload(this.buildUploadParams(newFileDataList, retryCustomCredentials))
							.then((retryRes) => {
								if (retryRes.rejected.length > 0) {
									logger.error({
										eventKey: "re_upload_file_failed",
										errorKind: "unknown",
										error: retryRes.rejected,
										message: "reUpload file failed",
									})
								}
							})
					}
				}
			})

		return fileDataList
	}

	addPendingProjectFileReferences(items: TiptapMentionAttributes[]) {
		const existingFileIds = new Set(
			this.files.flatMap((file) =>
				[file.id, file.reportResult?.file_id, file.saveResult?.file_id].filter(
					(fileId): fileId is string => Boolean(fileId),
				),
			),
		)
		const pastedFiles = createPastedProjectFileReferences(items, existingFileIds)

		if (pastedFiles.length === 0) return
		const availableSlots = Math.max(this.maxUploadCount - this.files.length, 0)
		pastedFiles.slice(0, availableSlots).forEach((file) => {
			this.sessionSavedProjectFileIds.add(file.id)
		})
		this.setFilesWithLimit((prev) => [...prev, ...pastedFiles])
	}

	restorePastedUploadFileReferences(items: TiptapMentionAttributes[]) {
		const existingFileIds = new Set(
			this.files.flatMap((file) =>
				[file.id, file.reportResult?.file_id, file.saveResult?.file_id].filter(
					(fileId): fileId is string => Boolean(fileId),
				),
			),
		)
		const restoredFiles = createPastedUploadFileReferences(items, existingFileIds)

		if (restoredFiles.length === 0) return
		const availableSlots = Math.max(this.maxUploadCount - this.files.length, 0)
		restoredFiles.slice(0, availableSlots).forEach((file) => {
			this.sessionUploadFileIds.add(file.id)
		})
		this.setFilesWithLimit((prev) => [...prev, ...restoredFiles])
	}

	async handleRetry(fileId: string) {
		const file = this.files.find((f) => f.id === fileId)
		if (!file) return

		const customCredentials = await this.uploadTokenService.getUploadToken(
			this.projectId,
			file.parentId,
			true,
		)

		this.uploadService.upload(this.buildUploadParams([file], customCredentials)).then((res) => {
			if (res.rejected.length > 0) {
				logger.error({
					eventKey: "re_upload_file_failed",
					errorKind: "unknown",
					error: res.rejected,
					message: "reUpload file failed",
				})
			}
		})
	}

	removeFile(id: string) {
		const target = this.files.find((f) => f.id === id)
		const targetWithReportResult = this.files.find((f) => f.reportResult?.file_id === id)
		const targetWithSaveResult = this.files.find((f) => f.saveResult?.file_id === id)

		if (!target && !targetWithReportResult && !targetWithSaveResult) return
		this.uploadHandlers.removeProgress(
			target?.id,
			targetWithReportResult?.id,
			targetWithSaveResult?.id,
		)

		if (target?.cancel) target.cancel()
		if (targetWithReportResult?.cancel) targetWithReportResult.cancel()
		if (targetWithSaveResult?.cancel) targetWithSaveResult.cancel()

		this.clearTrackedFileIds(target)
		this.clearTrackedFileIds(targetWithReportResult)
		this.clearTrackedFileIds(targetWithSaveResult)

		this.setFilesWithLimit((prev) =>
			prev.filter(
				(f) =>
					f.id !== id && f.reportResult?.file_id !== id && f.saveResult?.file_id !== id,
			),
		)

		this.onFileRemoved?.(id)
	}

	removeUploadedFile(fileId: string) {
		this.uploadHandlers.removeProgress(
			...this.files
				.filter(
					(file) =>
						file.reportResult?.file_id === fileId ||
						file.saveResult?.file_id === fileId,
				)
				.map((file) => file.id),
		)
		this.clearTrackedFileIdsByProjectFileId(fileId)
		this.setFilesWithLimit((prev) => {
			return prev.filter(
				(f) => f.reportResult?.file_id !== fileId && f.saveResult?.file_id !== fileId,
			)
		})
	}

	private clearFilesState() {
		this.uploadHandlers.clearProgress()
		this.files = []
		this.onFileUpload?.([])
		this.onChange?.([])
	}

	clearFiles() {
		this.files.forEach((file) => {
			if (file.cancel) file.cancel()
			this.clearTrackedFileIds(file)
			this.onFileRemoved?.(file.id)
		})
		this.clearFilesState()
	}

	clearFilesLocalOnly() {
		this.files.forEach((file) => {
			if (file.cancel) file.cancel()
			this.clearTrackedFileIds(file)
		})
		this.clearFilesState()
	}

	restoreFiles(restoredFiles: FileData[]) {
		if (restoredFiles.length === 0) return
		this.setFilesWithLimit(() => {
			this.onFileAdded?.(restoredFiles)
			return restoredFiles
		})
	}

	restoreFilesSilently(restoredFiles: FileData[]) {
		this.setFilesWithLimit(() => restoredFiles)
	}

	dispose() {
		this.clearFiles()
	}
}
