import { useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { runInAction } from "mobx"
import magicToast from "@/components/base/MagicToaster/utils"
import { base64ToFile } from "@/pages/superMagic/components/MessageEditor/utils/fileConverter"
import { resolveUploadPath } from "../../utils/file-utils"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { addMultipleFilesToCurrentChat } from "@/pages/superMagic/utils/topics"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "@/pages/superMagic/services"
import { topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface MagicUploadFileData {
	base64: string
	filename: string
	path: string
	fileSize: number
	fileType: string
}

interface MagicUploadFilesRequest {
	type: "MAGIC_UPLOAD_FILES_REQUEST"
	requestId: string
	files: MagicUploadFileData[]
}

interface MagicAddFilesToMessageRequest {
	type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST"
	requestId: string
	filePaths: string[]
	agentMode?: string
}

interface MagicDownloadFilesRequest {
	type: "MAGIC_DOWNLOAD_FILES_REQUEST"
	requestId: string
	filePaths: string[]
}

interface UseMagicFilesOptions {
	iframeRef: React.RefObject<HTMLIFrameElement>
	selectedProject?: any
	attachmentList?: any[]
	relative_file_path?: string
	uploadImageFileToProject: (params: {
		file: File
		path: string
		fileSize?: number
	}) => Promise<{ uploadedRelativeFilePath: string }>
}

interface UseMagicFilesReturn {
	handleMagicUploadFiles: (data: MagicUploadFilesRequest) => Promise<void>
	handleMagicAddFilesToMessage: (data: MagicAddFilesToMessageRequest) => Promise<void>
	handleMagicDownloadFiles: (data: MagicDownloadFilesRequest) => Promise<void>
}

// 从 attachmentList 中递归查找文件（仅内部使用）
function findFileInAttachments(attachments: any[], targetPath: string): any | null {
	if (!attachments || attachments.length === 0) return null

	const normalizePath = (p: string) => p.replace(/^\/+/, "").replace(/\/+$/, "")
	const normalizedTarget = normalizePath(targetPath)

	for (const item of attachments) {
		if (item.children && item.children.length > 0) {
			const found = findFileInAttachments(item.children, targetPath)
			if (found) return found
		}
		if (item.relative_file_path) {
			if (normalizePath(item.relative_file_path) === normalizedTarget) return item
		}
		if (item.file_path) {
			if (normalizePath(item.file_path) === normalizedTarget) return item
		}
	}
	return null
}

export function useMagicFiles(options: UseMagicFilesOptions): UseMagicFilesReturn {
	const {
		iframeRef,
		selectedProject,
		attachmentList,
		relative_file_path,
		uploadImageFileToProject,
	} = options
	const { t } = useTranslation("super")

	// Keep a stable ref to attachmentList so handlers always see latest value
	const attachmentListRef = useRef(attachmentList)
	attachmentListRef.current = attachmentList

	const replyToIframe = useMemoizedFn((type: string, requestId: string, payload: object) => {
		iframeRef.current?.contentWindow?.postMessage({ type, requestId, ...payload }, "*")
	})

	// ─── handleMagicUploadFiles ───────────────────────────────────────────────

	const handleMagicUploadFiles = useMemoizedFn(async (data: MagicUploadFilesRequest) => {
		const { requestId, files } = data
		const replyType = "MAGIC_UPLOAD_FILES_RESPONSE"

		if (!requestId || !Array.isArray(files) || files.length === 0) {
			replyToIframe(replyType, requestId, { success: false, error: "Invalid request data" })
			return
		}

		if (!selectedProject?.id) {
			replyToIframe(replyType, requestId, { success: false, error: "No project selected" })
			return
		}

		try {
			magicToast.loading({ content: t("topicFiles.fileUploading"), duration: 0 })

			const results = []
			for (const fileData of files) {
				try {
					const { base64, filename, path, fileSize } = fileData
					const file = base64ToFile(base64, filename)
					const uploadResult = await uploadImageFileToProject({ file, path, fileSize })
					results.push({
						filename,
						path,
						success: true,
						relative_file_path: uploadResult.uploadedRelativeFilePath,
					})
				} catch (err) {
					results.push({
						filename: fileData.filename,
						path: fileData.path,
						success: false,
						error: err instanceof Error ? err.message : "Unknown error",
					})
				}
			}

			replyToIframe(replyType, requestId, { success: true, results })

			pubsub.publish(PubSubEvents.Update_Attachments, () => {
				magicToast.destroy()
				magicToast.success(t("topicFiles.fileUploadSuccess"))
			})
		} catch (err) {
			replyToIframe(replyType, requestId, {
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
			magicToast.destroy()
			magicToast.error(t("topicFiles.fileUploadError", "文件上传失败"))
		}
	})

	// ─── handleMagicAddFilesToMessage ─────────────────────────────────────────

	const handleMagicAddFilesToMessage = useMemoizedFn(
		async (data: MagicAddFilesToMessageRequest) => {
			const { requestId, filePaths, agentMode } = data
			const replyType = "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE"

			if (!requestId || !Array.isArray(filePaths) || filePaths.length === 0) {
				replyToIframe(replyType, requestId, {
					success: false,
					error: "Invalid request data",
				})
				return
			}

			if (!selectedProject?.id) {
				replyToIframe(replyType, requestId, {
					success: false,
					error: "No project selected",
				})
				return
			}

			try {
				const foundFiles: any[] = []
				const notFoundPaths: string[] = []
				const currentAttachmentList = attachmentListRef.current

				for (const filePath of filePaths) {
					const resolvedPath = resolveUploadPath(filePath, relative_file_path)
					const fileItem = currentAttachmentList
						? findFileInAttachments(currentAttachmentList, resolvedPath)
						: null

					if (fileItem) {
						foundFiles.push(fileItem)
					} else {
						notFoundPaths.push(filePath)
					}
				}

				if (foundFiles.length === 0) {
					replyToIframe(replyType, requestId, {
						success: false,
						error: "No files found",
						notFoundPaths,
					})
					return
				}

				const finalAgentMode = agentMode || TopicMode.General
				const validModes = Object.values(TopicMode)
				if (!validModes.includes(finalAgentMode as TopicMode)) {
					replyToIframe(replyType, requestId, {
						success: false,
						error: `Invalid agentMode: ${finalAgentMode}`,
					})
					return
				}

				const workspaceId =
					selectedProject.workspace_id || workspaceStore.selectedWorkspace?.id || ""

				if (!workspaceId) {
					replyToIframe(replyType, requestId, {
						success: false,
						error: "Workspace ID not found",
					})
					return
				}

				const newTopic = await SuperMagicApi.createTopic({
					project_id: selectedProject.id,
					topic_name: "",
					project_mode: finalAgentMode as TopicMode,
				})

				if (!newTopic?.id) {
					replyToIframe(replyType, requestId, {
						success: false,
						error: "Failed to create topic",
					})
					return
				}

				const topicWithMode: any = { ...newTopic, topic_mode: finalAgentMode as TopicMode }

				runInAction(() => {
					topicStore.setSelectedTopic(topicWithMode)
				})

				pubsub.publish(PubSubEvents.Super_Magic_Topic_Mode_Changed, {
					mode: finalAgentMode as TopicMode,
					workspaceId,
					projectId: selectedProject.id,
				})

				SuperMagicService.route.navigateToState({ topicId: newTopic.id || null })

				// Wait for navigation before adding files to the message input
				setTimeout(() => {
					addMultipleFilesToCurrentChat({ fileItems: foundFiles, autoFocus: true })

					replyToIframe(replyType, requestId, {
						success: true,
						result: { foundCount: foundFiles.length, notFoundPaths },
					})
				}, 500)
			} catch (err) {
				replyToIframe("MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE", requestId, {
					success: false,
					error: err instanceof Error ? err.message : "Unknown error",
				})
			}
		},
	)

	// ─── handleMagicDownloadFiles ─────────────────────────────────────────────

	const handleMagicDownloadFiles = useMemoizedFn(async (data: MagicDownloadFilesRequest) => {
		const { requestId, filePaths } = data
		const replyType = "MAGIC_DOWNLOAD_FILES_RESPONSE"

		if (!requestId || !Array.isArray(filePaths) || filePaths.length === 0) {
			replyToIframe(replyType, requestId, { success: false, error: "Invalid request data" })
			return
		}

		try {
			const foundFiles: Array<{ fileItem: any; originalPath: string }> = []
			const notFoundPaths: string[] = []
			const currentAttachmentList = attachmentListRef.current

			for (const filePath of filePaths) {
				const resolvedPath = resolveUploadPath(filePath, relative_file_path)
				const fileItem = currentAttachmentList
					? findFileInAttachments(currentAttachmentList, resolvedPath)
					: null

				if (fileItem?.file_id) {
					foundFiles.push({ fileItem, originalPath: filePath })
				} else {
					notFoundPaths.push(filePath)
				}
			}

			if (foundFiles.length === 0) {
				replyToIframe(replyType, requestId, {
					success: false,
					error: "No files found",
					notFoundPaths,
				})
				return
			}

			const downloadResults: Array<{ path: string; success: boolean; error?: string }> = []

			await Promise.allSettled(
				foundFiles.map(async ({ fileItem, originalPath }) => {
					try {
						const downloadUrls = await getTemporaryDownloadUrl({
							file_ids: [fileItem.file_id],
						})

						if (!downloadUrls?.[0]?.url) {
							downloadResults.push({
								path: originalPath,
								success: false,
								error: "Failed to get download URL",
							})
							return
						}

						const fileName =
							fileItem.file_name ||
							fileItem.display_filename ||
							fileItem.filename ||
							undefined

						await downloadFileWithAnchor(downloadUrls[0].url, fileName)
						downloadResults.push({ path: originalPath, success: true })
					} catch (err) {
						downloadResults.push({
							path: originalPath,
							success: false,
							error: err instanceof Error ? err.message : "Unknown error",
						})
					}
				}),
			)

			const successCount = downloadResults.filter((r) => r.success).length
			const failedResults = downloadResults.filter((r) => !r.success)

			replyToIframe(replyType, requestId, {
				success: successCount > 0,
				result: {
					successCount,
					failedCount: failedResults.length,
					notFoundPaths,
					failedResults,
				},
			})
		} catch (err) {
			replyToIframe("MAGIC_DOWNLOAD_FILES_RESPONSE", requestId, {
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	})

	return { handleMagicUploadFiles, handleMagicAddFilesToMessage, handleMagicDownloadFiles }
}
