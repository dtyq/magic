import { t } from "i18next"
import { FileApi } from "@/opensource/apis"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import projectFilesStore from "@/opensource/stores/projectFiles"
import { logger as Logger } from "@/opensource/utils/log"
import { superMagicUploadTokenService } from "../../services/UploadTokenService"
import {
	AttachmentSource,
	type AttachmentItem,
} from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"
import { FileData, UploadSource } from "../../types"
import type { UploadResponse } from "../../services/UploadService"

const logger = Logger.createLogger("SuperMagicUpload")

interface UploadHandlersContext {
	getProjectId: () => string
	getTopicId: () => string
	getStorageType: () => "workspace" | "topic"
	getSource: () => UploadSource | undefined
	trackSavedProjectFileId: (fileId?: string) => void
	setFilesWithLimit: (updater: (prev: FileData[]) => FileData[]) => void
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
}

interface UploadHandlers {
	handleProgress: (file: FileData, progress: number) => void
	handleSuccess: (file: FileData, response: UploadResponse) => Promise<void>
	handleFail: (file: FileData, error?: unknown) => void
	handleInit: (file: FileData, tools: { cancel?: () => void }) => void
}

function mapUploadSourceToAttachmentSource(source?: UploadSource): AttachmentSource {
	if (source === UploadSource.Home) return AttachmentSource.HOME
	if (source === UploadSource.ProjectFile) return AttachmentSource.PROJECT_DIRECTORY
	if (source === UploadSource.AgentFile) return AttachmentSource.AGENT
	return AttachmentSource.DEFAULT
}

export function createUploadHandlers(context: UploadHandlersContext): UploadHandlers {
	const handleProgress = (file: FileData, progress: number) => {
		context.setFilesWithLimit((prev) => {
			const newFiles = [...prev]
			const target = newFiles.find((f) => f.id === file.id)
			if (target) {
				target.status = "uploading"
				target.progress = progress
				context.onFileProgressUpdate?.(file.id, progress, "uploading")
			}
			return newFiles
		})
	}

	const handleSuccess = async (file: FileData, response: UploadResponse) => {
		try {
			const reportResult = await FileApi.reportFileUploads([
				{
					file_extension: file.name.split(".").pop() ?? "",
					file_key: response.key,
					file_size: response.size,
					file_name: response.name,
				},
			])

			const projectId = context.getProjectId()
			if (!projectId) {
				context.setFilesWithLimit((prev) => {
					const newFiles = [...prev]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.status = "done"
						target.result = response
						target.reportResult = reportResult[0]
						context.trackSavedProjectFileId(reportResult[0]?.file_id)
						context.onFileCompleted?.(file.id, reportResult[0], undefined)
					}
					return newFiles
				})
				return
			}

			let saveRes: FileData["saveResult"] | undefined
			try {
				saveRes = await superMagicUploadTokenService.saveFileToProject({
					project_id: projectId,
					topic_id: context.getTopicId(),
					file_key: response.key,
					file_name: response.name,
					file_size: response.size,
					file_type: "user_upload",
					storage_type: context.getStorageType(),
					source: context.getSource() ?? UploadSource.Home,
				})
			} catch (error) {
				logger.error("save file to project failed", error)
			}

			pubsub.publish(PubSubEvents.Update_Attachments)

			if (saveRes && projectFilesStore.currentSelectedProject?.id === projectId) {
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
						source: mapUploadSourceToAttachmentSource(context.getSource()),
						task_id: saveRes.task_id,
						topic_id: saveRes.topic_id,
						project_id: saveRes.project_id,
						file_type: saveRes.file_type,
					}

					projectFilesStore.workspaceFilesList = projectFilesStore.excludeHiddenItems([
						...projectFilesStore.workspaceFilesList,
						optimisticItem,
					])
				}
			}

			context.setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "done"
					target.result = response
					target.reportResult = reportResult[0]
					target.saveResult = saveRes
					context.trackSavedProjectFileId(reportResult[0]?.file_id)
					context.trackSavedProjectFileId(saveRes?.file_id)
					context.onFileCompleted?.(file.id, reportResult[0], saveRes)
				}
				return newFiles
			})
		} catch (error) {
			logger.error("report file failed", error)
			context.setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "error"
					target.error = t("fileUpload.fileReportFailed", { ns: "super" })
					context.onFileProgressUpdate?.(
						file.id,
						0,
						"error",
						t("fileUpload.fileReportFailed", { ns: "super" }),
					)
				}
				return newFiles
			})
		}
	}

	const handleFail = (file: FileData, error?: unknown) => {
		const errorMessage =
			typeof error === "string"
				? error
				: (error as { message?: string })?.message ||
					t("fileUpload.uploadFailed", { ns: "super" })

		context.setFilesWithLimit((prev) => {
			const newFiles = [...prev]
			const target = newFiles.find((f) => f.id === file.id)
			if (target) {
				target.status = "error"
				target.error = errorMessage
				context.onFileProgressUpdate?.(file.id, 0, "error", errorMessage)
			}
			return newFiles
		})

		logger.error("upload failed", { fileId: file.id, message: errorMessage })
	}

	const handleInit = (file: FileData, { cancel }: { cancel?: () => void }) => {
		context.setFilesWithLimit((prev) => {
			const newFiles = [...prev]
			const target = newFiles.find((f) => f.id === file.id)
			if (target) {
				target.cancel = cancel
			}
			return newFiles
		})
	}

	return {
		handleProgress,
		handleSuccess,
		handleFail,
		handleInit,
	}
}
