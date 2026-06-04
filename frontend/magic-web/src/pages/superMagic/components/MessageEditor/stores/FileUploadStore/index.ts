import { makeAutoObservable } from "mobx"
import { t } from "i18next"
import { logger as Logger } from "@/utils/log"
import {
	type DirectoryMentionData,
	MentionItemType,
	type ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { UploadMentionItem } from "@/components/business/MentionPanel/runtime/builtin/domains/upload-files"
import projectFilesStore, { type ProjectFilesStore } from "@/stores/projectFiles"
import magicToast from "@/components/base/MagicToaster/utils"
import { generateUniqueFileName } from "../../utils/generateUniqueFileName"
import { superMagicUploadTokenService } from "../../services/UploadTokenService"
import { UploadService } from "../../services/UploadService"
import type { FileData } from "../../types"
import { UploadSource } from "../../types"
import { isPendingProjectFileMention } from "../../utils/mention"
import {
	validateDuplicateFiles,
	validateFileCount,
	validateFileSize,
	validateEmptyFiles,
} from "./validators"
import { createUploadHandlers } from "./uploadHandlers"

export interface FileUploadStoreOptions {
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
	private projectFilesStore: ProjectFilesStore

	constructor(options: FileUploadStoreOptions = {}) {
		this.projectFilesStore = options.projectFilesStore ?? projectFilesStore
		makeAutoObservable(
			this,
			{},
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
			trackSavedProjectFileId: (fileId) => this.trackSavedProjectFileId(fileId),
			setFilesWithLimit: (updater) => this.setFilesWithLimit(updater),
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

	isCurrentSessionUploadFile(fileId: string) {
		return this.sessionUploadFileIds.has(fileId)
	}

	isCurrentSessionProjectFile(fileId: string) {
		return this.sessionSavedProjectFileIds.has(fileId)
	}

	getUploadMentionItems(): UploadMentionItem[] {
		return this.files.flatMap((file) => {
			const filePath = file.reportResult?.file_key
			if (!filePath) return []

			const fileId = file.reportResult?.file_id || file.id
			const fileName = file.reportResult?.file_name || file.name
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
						file_extension: fileExtension,
						file_size: file.reportResult?.file_size ?? file.file.size,
						file: file.file,
						upload_progress: file.progress,
						upload_status: file.status,
						upload_error: file.error,
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

	private buildUploadParams(
		fileList: FileData[],
		customCredentials?: Parameters<UploadService<FileData>["upload"]>[0]["customCredentials"],
		customOption?: Parameters<UploadService<FileData>["upload"]>[0]["customOption"],
	) {
		return {
			fileList,
			customCredentials,
			customOption,
			url: superMagicUploadTokenService.getUploadTokenUrl,
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

	async addFiles(newFiles: File[], parentId?: string) {
		const duplicateValidation = this.validateDuplicateFiles(newFiles, parentId)
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
			.filter((f) => f.parentId === parentId)
			.map((f) => f.name)

		for (const file of validFiles) {
			const uniqueFileName = generateUniqueFileName(
				file.name,
				this.files,
				processedNames,
				parentId,
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
				parentId,
			})
		}

		const customCredentials = await superMagicUploadTokenService.getUploadToken(
			this.projectId,
			parentId,
		)

		if (this.projectId && customCredentials) {
			const projectFileNames = this.projectFilesStore.getFileNamesInFolder(
				customCredentials.temporary_credential.dir,
			)

			const existingFileNamesInSameDir = this.files
				.filter((f) => f.parentId === parentId)
				.map((f) => f.name)
			const processedFileNames: string[] = existingFileNamesInSameDir.concat(projectFileNames)

			fileDataList = fileDataList.map((fileData) => {
				const finalFileName = generateUniqueFileName(
					fileData.name,
					this.files,
					processedFileNames,
					parentId,
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
						parentId,
					}
				}

				return fileData
			})
		}

		this.trackSessionUploads(fileDataList)

		this.setFilesWithLimit((prev) => {
			const newList = [...prev, ...fileDataList]
			this.onFileAdded?.(fileDataList)
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
						await superMagicUploadTokenService.fetchUploadToken(this.projectId)
					}

					const newCustomCredentials = await superMagicUploadTokenService.getUploadToken(
						this.projectId,
						parentId,
						true,
					)

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
							.upload(this.buildUploadParams(newFileDataList, newCustomCredentials))
							.then((retryRes) => {
								if (retryRes.rejected.length > 0) {
									logger.error("reUpload file failed", retryRes.rejected)
								}
							})
					}
				}
			})

		return fileDataList
	}

	addPendingProjectFileReferences(items: TiptapMentionAttributes[]) {
		const pendingProjectFiles = items.filter(isPendingProjectFileMention)
		if (pendingProjectFiles.length === 0) return

		const existingFileIds = new Set(
			this.files.flatMap((file) =>
				[file.id, file.reportResult?.file_id, file.saveResult?.file_id].filter(
					(fileId): fileId is string => Boolean(fileId),
				),
			),
		)
		const pastedFiles = pendingProjectFiles
			.map((item): FileData | null => {
				const data = item.data as ProjectFileMentionData | DirectoryMentionData
				const isDirectory = item.type === MentionItemType.FOLDER
				const fileId = isDirectory
					? (data as DirectoryMentionData).source_directory_id ||
						(data as DirectoryMentionData).directory_id
					: (data as ProjectFileMentionData).source_file_id ||
						(data as ProjectFileMentionData).file_id
				if (!fileId || existingFileIds.has(fileId)) return null

				existingFileIds.add(fileId)
				this.sessionSavedProjectFileIds.add(fileId)
				const name = isDirectory
					? (data as DirectoryMentionData).directory_name
					: (data as ProjectFileMentionData).file_name
				const path = isDirectory
					? (data as DirectoryMentionData).directory_path
					: (data as ProjectFileMentionData).file_path

				return {
					id: fileId,
					name,
					file: new File([], name),
					status: "done",
					isVirtualReference: true,
					progress: 100,
					saveResult: {
						file_id: fileId,
						file_key: path,
						file_name: name,
						file_size: isDirectory
							? 0
							: ((data as ProjectFileMentionData).file_size ?? 0),
						file_type: isDirectory ? "directory" : "user_upload",
						project_id: data.source_project_id ?? "",
						topic_id: "",
						task_id: "",
						created_at: "",
						relative_file_path: path,
					},
				}
			})
			.filter((file): file is FileData => Boolean(file))

		if (pastedFiles.length === 0) return

		this.setFilesWithLimit((prev) => [...prev, ...pastedFiles])
	}

	async handleRetry(fileId: string) {
		const file = this.files.find((f) => f.id === fileId)
		if (!file) return

		const customCredentials = await superMagicUploadTokenService.getUploadToken(
			this.projectId,
			file.parentId,
			true,
		)

		this.uploadService.upload(this.buildUploadParams([file], customCredentials)).then((res) => {
			if (res.rejected.length > 0) {
				logger.error("reUpload file failed", res.rejected)
			}
		})
	}

	removeFile(id: string) {
		const target = this.files.find((f) => f.id === id)
		const targetWithReportResult = this.files.find((f) => f.reportResult?.file_id === id)
		const targetWithSaveResult = this.files.find((f) => f.saveResult?.file_id === id)

		if (!target && !targetWithReportResult && !targetWithSaveResult) return

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
		this.clearTrackedFileIdsByProjectFileId(fileId)
		this.setFilesWithLimit((prev) => {
			return prev.filter(
				(f) => f.reportResult?.file_id !== fileId && f.saveResult?.file_id !== fileId,
			)
		})
	}

	private clearFilesState() {
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
