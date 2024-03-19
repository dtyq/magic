import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { FileData, UploadSource } from "../types"
import { SaveUploadFileToProjectResponse } from "../../../utils/api"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { superMagicUploadTokenService } from "../services/UploadTokenService"
import projectFilesStore from "@/opensource/stores/projectFiles"
import { logger as Logger } from "@/opensource/utils/log"
import { generateUniqueFileName } from "../utils/generateUniqueFileName"
import {
	AttachmentSource,
	type AttachmentItem,
} from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export { UploadSource }

export interface UseFileUploadOptions {
	maxUploadCount?: number
	maxUploadSize?: number
	maxMediaUploadSize?: number
	projectId?: string
	topicId?: string
	suffixDir?: string // 自定义上传目录，默认为"uploads"
	onFileUpload?: (files: FileData[]) => void
	// New mention management callbacks
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
	storageType?: "workspace" | "topic" //如果在项目列表导入传 workspace ， 如果在 话题就传 topic
	source?: UploadSource
	needFilterSameFile?: boolean
	onChange?: (files: FileData[]) => void
}

const logger = Logger.createLogger("SuperMagicUpload")
const DEFAULT_MEDIA_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
const BYTES_PER_MB = 1024 * 1024
const AUDIO_VIDEO_EXTENSIONS = new Set([
	"mp3",
	"wav",
	"flac",
	"aac",
	"m4a",
	"ogg",
	"wma",
	"opus",
	"mp4",
	"mov",
	"avi",
	"mkv",
	"webm",
	"m4v",
	"wmv",
	"mpeg",
	"mpg",
	"3gp",
])

function mapUploadSourceToAttachmentSource(source?: UploadSource): AttachmentSource {
	if (source === UploadSource.Home) return AttachmentSource.HOME
	if (source === UploadSource.ProjectFile) return AttachmentSource.PROJECT_DIRECTORY
	if (source === UploadSource.AgentFile) return AttachmentSource.AGENT
	// RecordSummary / unknown sources fall back to DEFAULT for now
	return AttachmentSource.DEFAULT
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
	const {
		maxUploadCount = 20,
		onFileUpload,
		projectId,
		topicId,
		suffixDir = "uploads",
		onFileAdded,
		onFileProgressUpdate,
		onFileCompleted,
		onFileRemoved,
		maxUploadSize = 1024 * 1024 * 100, // 100MB
		maxMediaUploadSize = DEFAULT_MEDIA_UPLOAD_SIZE, // 2GB
		needFilterSameFile = true,
		onChange,
	} = options
	const [files, setFiles] = useState<FileData[]>([])
	const { t } = useTranslation("super")

	const setFilesWithLimit = useMemoizedFn(
		(newFiles: FileData[] | ((prev: FileData[]) => FileData[])) => {
			setFiles((prevFiles) => {
				const fileList = typeof newFiles === "function" ? newFiles(prevFiles) : newFiles
				const limitedFiles = fileList.slice(0, maxUploadCount)

				if (fileList.length > maxUploadCount) {
					magicToast.error(t("fileUpload.maxFilesReached", { maxCount: maxUploadCount }))
				}

				if (onFileUpload) {
					onFileUpload(limitedFiles)
				}

				onChange?.(limitedFiles)

				return limitedFiles
			})
		},
	)

	const handleRetry = useMemoizedFn(async (fileId: string) => {
		const file = files.find((f) => f.id === fileId)
		if (!file) return

		const customCredentials = await superMagicUploadTokenService.getUploadToken(
			projectId ?? "",
			file.suffixDir,
			true,
		)
		upload([file], customCredentials).then(async (res) => {
			if (res.rejected.length > 0) {
				logger.error("reUpload file failed", res.rejected)
			}
		})
	})

	const { upload, uploading, reportFiles } = useUpload<FileData>({
		url: superMagicUploadTokenService.getUploadTokenUrl,
		body: {
			project_id: projectId ?? "",
			expires: 3600,
		},
		rewriteFileName: false,
		onProgress(file, progress) {
			setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "uploading"
					target.progress = progress
					// Event-driven: 直接调用进度更新回调
					onFileProgressUpdate?.(file.id, progress, "uploading")
				}
				return newFiles
			})
		},
		async onSuccess(file, response) {
			try {
				// 先调用 reportFiles 上报文件信息
				const reportResult = await reportFiles([
					{
						file_extension: file.name.split(".").pop() ?? "",
						file_key: response.key,
						file_size: response.size,
						file_name: response.name,
					},
				])

				// 不在项目内
				if (!projectId) {
					// 只有上报成功后才设置为完成状态
					setFilesWithLimit((prev) => {
						const newFiles = [...prev]
						const target = newFiles.find((f) => f.id === file.id)
						if (target) {
							target.status = "done"
							target.result = response
							target.reportResult = reportResult[0] // 保存上报结果
							// Event-driven: 直接调用完成回调
							onFileCompleted?.(file.id, reportResult[0], undefined)
						}
						return newFiles
					})
					return
				}

				let saveRes: SaveUploadFileToProjectResponse | undefined
				try {
					saveRes = await superMagicUploadTokenService.saveFileToProject({
						project_id: projectId ?? "",
						topic_id: topicId ?? "",
						file_key: response.key,
						file_name: response.name,
						file_size: response.size,
						file_type: "user_upload",
						storage_type: options.storageType ?? "workspace",
						source: options.source ?? UploadSource.Home,
					})
				} catch (error) {
					logger.error("save file to project failed", error)
				}

				// 触发更新文件列表
				pubsub.publish(PubSubEvents.Update_Attachments)

				// 乐观更新：先把附件写入 projectFilesStore，
				// 这样 MentionPanel 在附件轮询回来之前也能搜到。
				if (
					saveRes &&
					projectId &&
					projectFilesStore.currentSelectedProject?.id === projectId
				) {
					const isAlreadyInList = saveRes.file_id
						? projectFilesStore.hasProjectFile(saveRes.file_id)
						: false
					if (!isAlreadyInList) {
						const extension = saveRes.file_name?.split(".").pop() ?? ""
						const optimisticItem: AttachmentItem = {
							type: "file",
							file_id: saveRes.file_id,
							file_name: saveRes.file_name,
							file_extension: extension,
							file_key: saveRes.file_key,
							relative_file_path: saveRes.relative_file_path ?? saveRes.file_key,
							file_size: saveRes.file_size,
							is_hidden: false,
							children: [],
							source: mapUploadSourceToAttachmentSource(options.source),
							task_id: saveRes.task_id,
							topic_id: saveRes.topic_id,
							project_id: saveRes.project_id,
							file_type: saveRes.file_type,
						}

						projectFilesStore.workspaceFilesList = projectFilesStore.excludeHiddenItems(
							[...projectFilesStore.workspaceFilesList, optimisticItem],
						)
					}
				}

				// 只有上报成功后才设置为完成状态
				setFilesWithLimit((prev) => {
					const newFiles = [...prev]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.status = "done"
						target.result = response
						target.reportResult = reportResult[0] // 保存上报结果
						target.saveResult = saveRes
						// Event-driven: 直接调用完成回调
						onFileCompleted?.(file.id, reportResult[0], saveRes)
					}
					return newFiles
				})
			} catch (error) {
				logger.error("report file failed", error)
				// 上报失败时设置为错误状态
				setFilesWithLimit((prev) => {
					const newFiles = [...prev]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.status = "error"
						target.error = t("fileUpload.fileReportFailed")
						// Event-driven: 直接调用进度更新回调
						onFileProgressUpdate?.(
							file.id,
							0,
							"error",
							t("fileUpload.fileReportFailed"),
						)
					}
					return newFiles
				})
			}
		},
		onFail(file, error) {
			const errorMessage =
				typeof error === "string" ? error : error?.message || t("fileUpload.uploadFailed")

			setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "error"
					target.error = errorMessage
					// Event-driven: 直接调用进度更新回调
					onFileProgressUpdate?.(file.id, 0, "error", errorMessage)
				}
				return newFiles
			})

			logger.error("upload failed", { fileId: file.id, message: errorMessage })
		},
		onInit(file, { cancel }) {
			setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.cancel = cancel
				}
				return newFiles
			})
		},
	})

	// Validation functions
	const validateDuplicateFiles = useMemoizedFn((newFiles: File[], targetSuffixDir: string) => {
		if (!needFilterSameFile) {
			return { validFiles: newFiles, hasWarning: false }
		}

		const uniqueFiles = newFiles.filter((newFile) => {
			const isDuplicate = files.some((existingFile) => {
				return (
					existingFile.file.name === newFile.name &&
					existingFile.file.size === newFile.size &&
					existingFile.file.lastModified === newFile.lastModified &&
					existingFile.suffixDir === targetSuffixDir
				)
			})
			return !isDuplicate
		})

		const hasWarning = uniqueFiles.length < newFiles.length
		if (hasWarning) {
			const duplicateCount = newFiles.length - uniqueFiles.length
			magicToast.warning(t("fileUpload.duplicateFilesFiltered", { count: duplicateCount }))
			logger.warn("duplicate files filtered", {
				count: duplicateCount,
				suffixDir: targetSuffixDir,
			})
		}

		return { validFiles: uniqueFiles, hasWarning }
	})

	const isAudioOrVideoFile = useMemoizedFn((file: File) => {
		if (file.type) {
			return file.type.startsWith("audio/") || file.type.startsWith("video/")
		}

		const extension = file.name.split(".").pop()?.toLowerCase()
		return extension ? AUDIO_VIDEO_EXTENSIONS.has(extension) : false
	})

	const validateFileSize = useMemoizedFn((files: File[]) => {
		let generalExceededCount = 0
		let mediaExceededCount = 0

		const validFiles = files.filter((file) => {
			const isMedia = isAudioOrVideoFile(file)
			const currentLimit = isMedia ? maxMediaUploadSize : maxUploadSize
			const isValid = file.size <= currentLimit

			if (!isValid) {
				if (isMedia) {
					mediaExceededCount += 1
				} else {
					generalExceededCount += 1
				}
			}

			return isValid
		})

		const filteredCount = generalExceededCount + mediaExceededCount
		const hasWarning = filteredCount > 0
		if (hasWarning) {
			if (generalExceededCount > 0) {
				magicToast.warning(
					t("fileUpload.fileSizeExceeded", { maxSize: maxUploadSize / BYTES_PER_MB }),
				)
			}

			if (
				mediaExceededCount > 0 &&
				(generalExceededCount === 0 || maxMediaUploadSize !== maxUploadSize)
			) {
				magicToast.warning(
					t("fileUpload.fileSizeExceeded", {
						maxSize: maxMediaUploadSize / BYTES_PER_MB,
					}),
				)
			}

			logger.warn("file size exceeded filtered", {
				maxSize: maxUploadSize,
				mediaMaxSize: maxMediaUploadSize,
				filteredCount,
				generalExceededCount,
				mediaExceededCount,
			})
		}

		return { validFiles, hasWarning }
	})

	const validateFileCount = useMemoizedFn((filesToValidate: File[]) => {
		if (!maxUploadCount) {
			return { validFiles: filesToValidate, hasError: false }
		}

		const totalCount = files.length + filesToValidate.length
		if (totalCount <= maxUploadCount) {
			return { validFiles: filesToValidate, hasError: false }
		}

		const allowedCount = maxUploadCount - files.length
		const validFiles = filesToValidate.slice(0, allowedCount)

		magicToast.error(t("fileUpload.maxFilesReached", { maxCount: maxUploadCount }))
		logger.warn("max files reached", { maxUploadCount, currentCount: files.length })

		return { validFiles, hasError: true }
	})

	const validateEmptyFiles = useMemoizedFn((files: File[]) => {
		if (files.length === 0) {
			logger.warn("no files to add after filtering")
			return false
		}
		return true
	})

	const addFiles = useMemoizedFn(async (newFiles: File[], customSuffixDir?: string) => {
		console.log("useFileUpload addFiles 开始执行:", newFiles)

		// 使用传入的suffixDir或默认值
		const targetSuffixDir = customSuffixDir ?? suffixDir

		// Step 1: Validate duplicate files
		const duplicateValidation = validateDuplicateFiles(newFiles, targetSuffixDir)
		let validFiles = duplicateValidation.validFiles

		// Step 2: Validate file size
		const sizeValidation = validateFileSize(validFiles)
		validFiles = sizeValidation.validFiles

		// Step 3: Validate file count
		const countValidation = validateFileCount(validFiles)
		validFiles = countValidation.validFiles

		// Step 4: Check if any files remain after validation
		if (!validateEmptyFiles(validFiles)) {
			return
		}

		// Continue with file processing after validation...

		// Step 1: First rename to avoid conflicts with current upload queue
		let fileDataList: FileData[] = []
		// Only include names from files with the same target directory
		const processedNames: string[] = files
			.filter((f) => f.suffixDir === targetSuffixDir)
			.map((f) => f.name)

		for (const file of validFiles) {
			const uniqueFileName = generateUniqueFileName(
				file.name,
				files,
				processedNames,
				targetSuffixDir,
			)

			// Add the new name to processed names for next iteration
			processedNames.push(uniqueFileName)

			// Create new File object with unique name if renamed
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
				suffixDir: targetSuffixDir,
			})
		}

		const customCredentials = await superMagicUploadTokenService.getUploadToken(
			projectId ?? "",
			targetSuffixDir,
		)

		// Step 2: Check project files and rename again if needed
		if (projectId && customCredentials) {
			// Get project file names for comparison using the new method
			const projectFileNames = projectFilesStore.getFileNamesInFolder(
				customCredentials.temporary_credential.dir,
			)

			// Rename files that conflict with project files
			// Only include names from files with the same target directory
			const existingFileNamesInSameDir = files
				.filter((f) => f.suffixDir === targetSuffixDir)
				.map((f) => f.name)
			const processedFileNames: string[] = existingFileNamesInSameDir.concat(projectFileNames) // Track both existing files and project files

			fileDataList = fileDataList.map((fileData) => {
				const finalFileName = generateUniqueFileName(
					fileData.name,
					files,
					processedFileNames,
					targetSuffixDir,
				)

				// Add the new name to processed names for next iteration
				processedFileNames.push(finalFileName)

				if (finalFileName !== fileData.name) {
					// Create new File object with final unique name
					const finalRenamedFile = new File([fileData.file], finalFileName, {
						type: fileData.file.type,
						lastModified: fileData.file.lastModified,
					})

					return {
						...fileData,
						name: finalFileName,
						file: finalRenamedFile,
						suffixDir: targetSuffixDir,
					}
				}

				return fileData
			})
		}

		console.log("创建的文件数据:", fileDataList)
		// Keep side effects out of state updater to avoid duplicate calls in StrictMode
		onFileAdded?.(fileDataList)
		setFilesWithLimit((prev) => [...prev, ...fileDataList])

		// Start uploading immediately
		upload(fileDataList, customCredentials).then(async (res) => {
			if (res.rejected.length > 0) {
				// 如果项目存在，则重新获取上传凭证
				if (projectId) {
					const hasExpired = res.rejected.filter((item) =>
						item.reason?.message?.includes("expired"),
					)
					if (hasExpired.length > 0) {
						// 如果上传凭证过期，则重新获取上传凭证
						logger.warn("upload credentials expired, refreshing and retrying", {
							expiredCount: hasExpired.length,
						})
						await superMagicUploadTokenService.fetchUploadToken(projectId)
					}

					const newCustomCredentials = await superMagicUploadTokenService.getUploadToken(
						projectId,
						targetSuffixDir,
						true,
					)

					// 重新上传失败文件
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

					// 重新上传失败文件
					if (newFileDataList.length > 0) {
						logger.warn("retrying failed uploads", { count: newFileDataList.length })
						upload(newFileDataList, newCustomCredentials).then((res) => {
							if (res.rejected.length > 0) {
								logger.error("reUpload file failed", res.rejected)
							}
						})
					}
				}
			}
		})
		return fileDataList
	})

	const removeFile = useMemoizedFn((id: string) => {
		setFilesWithLimit((prev) => {
			const target = prev.find((f) => f.id === id)
			const targetWithReportResult = prev.find((f) => f.reportResult?.file_id === id)
			const targetWithSaveResult = prev.find((f) => f.saveResult?.file_id === id)

			if (target?.cancel) {
				target.cancel()
			}

			if (targetWithReportResult?.cancel) {
				targetWithReportResult.cancel()
			}

			if (targetWithSaveResult?.cancel) {
				targetWithSaveResult.cancel()
			}

			// Event-driven: 直接调用文件移除回调
			onFileRemoved?.(id)

			return prev.filter((f) => {
				return f.id !== id && f.reportResult?.file_id !== id && f.saveResult?.file_id !== id
			})
		})
	})

	const removeUploadedFile = useMemoizedFn((fileId: string) => {
		setFilesWithLimit((prev) => {
			return prev.filter((f) => f.reportResult?.file_id !== fileId)
		})
	})

	const clearFiles = useMemoizedFn(() => {
		// Cancel all ongoing uploads
		files.forEach((file) => {
			if (file.cancel) {
				file.cancel()
			}
			// Event-driven: 直接调用文件移除回调
			onFileRemoved?.(file.id)
		})
		setFiles([])
		onFileUpload?.([])
	})

	const isAllFilesUploaded = files.length === 0 || files.every((file) => file.status === "done")

	// Restore files from draft cache
	const restoreFiles = useMemoizedFn((restoredFiles: FileData[]) => {
		if (restoredFiles.length === 0) return

		// Keep side effects out of state updater to avoid duplicate calls in StrictMode
		onFileAdded?.(restoredFiles)
		setFilesWithLimit(restoredFiles)
	})

	return {
		files,
		uploading,
		addFiles,
		removeFile,
		removeUploadedFile,
		clearFiles,
		restoreFiles, // New method for draft restoration
		isAllFilesUploaded,
		handleRetry,

		validateDuplicateFiles,
		validateFileSize,
		validateFileCount,
		validateEmptyFiles,
	}
}
