import { useTranslation } from "react-i18next"
import {
	BatchSaveInfo,
	multiFolderUploadStore,
	UploadFileWithKey,
} from "@/opensource/stores/folderUpload"
import { UploadSource } from "../../MessageEditor/hooks/useFileUpload"
import {
	getFileExtension,
	getMimeTypeExtensions,
	isFileTypeMatching,
} from "../../../utils/handleFIle"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import type { AttachmentItem } from "./types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { SuperMagicApi } from "@/opensource/apis"

interface UseFileReplaceOptions {
	projectId?: string
	selectedProject?: any
	selectedTopic?: any
}

/**
 * 文件替换功能的共享 hook
 */
export function useFileReplace({
	projectId,
	selectedProject,
	selectedTopic,
}: UseFileReplaceOptions) {
	const { t } = useTranslation("super")
	const workspaceId = selectedProject?.workspace_id

	// 请求替换文件
	const replaceFileRequest = async (item: AttachmentItem, newFile: File) => {
		if (!projectId || !selectedProject) {
			magicToast.error(t("common.projectNotSelected"))
			return
		}

		if (!item.file_key) {
			magicToast.error("文件key不存在，无法替换")
			return
		}

		try {
			// 使用新的对象数组格式，传递自定义fileKey
			const filesWithKeys: UploadFileWithKey[] = [
				{
					file: newFile,
					customFileKey: item.file_key, // 使用原文件的key进行替换
				},
			]

			await multiFolderUploadStore.createUploadTask(filesWithKeys, "", {
				projectId: projectId || "",
				workspaceId,
				projectName: selectedProject?.project_name || t("common.untitledProject"),
				topicId: selectedTopic?.id,
				taskId: "",
				storageType: "workspace",
				source: UploadSource.ProjectFile,
				onlyUpload: true, // 🔥 仅上传模式
				onBatchSaveComplete: async (batchSaveInfo: BatchSaveInfo) => {
					// 使用上传完成的文件进行替换
					if (batchSaveInfo.savedFiles && batchSaveInfo.savedFiles.length > 0) {
						const uploadedFile = batchSaveInfo.savedFiles[0] // 取第一个上传成功的文件
						try {
							await SuperMagicApi.replaceFile({
								id: item.file_id || "",
								file_key: uploadedFile.file_key,
							})
							magicToast.success(t("topicFiles.contextMenu.replaceFileSuccess"))
							// 刷新文件列表
							pubsub.publish(PubSubEvents.Update_Attachments)
							pubsub.publish(PubSubEvents.Super_Magic_Detail_Refresh)
						} catch (replaceError) {
							console.error("Replace file error:", replaceError)
						}
					}
				},
			})
		} catch (error) {
			magicToast.error(t("topicFiles.contextMenu.createUploadTaskFailed"))
		}
	}

	// 检查文件类型是否匹配的辅助函数
	const checkFileTypeMatching = (originalFile: AttachmentItem, newFile: File): boolean => {
		const originalExt =
			originalFile.file_extension?.toLowerCase() ||
			getFileExtension(originalFile.file_name || originalFile.filename || "")
		const newExt = getFileExtension(newFile.name)
		return isFileTypeMatching(originalExt, newExt)
	}

	// 处理替换文件
	const handleReplaceFile = (item: AttachmentItem) => {
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = false
		input.style.display = "none"
		// 设置 accept 属性，限制只能选择兼容类型的文件
		const originalExt =
			item.file_extension?.toLowerCase() ||
			getFileExtension(item.file_name || item.filename || "")
		if (originalExt) {
			const compatibleExts = getMimeTypeExtensions(originalExt)
			input.accept = compatibleExts.map((ext) => `.${ext}`).join(",")
		}
		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files
			if (files && files.length > 0) {
				const selectedFile = files[0]
				// 检查文件类型是否匹配
				if (!checkFileTypeMatching(item, selectedFile)) {
					const originalExt =
						item.file_extension?.toLowerCase() ||
						getFileExtension(item.file_name || item.filename || "")
					const newExt = getFileExtension(selectedFile.name)
					magicToast.error(
						t("topicFiles.contextMenu.replaceFileTypeMismatch", {
							originalType: originalExt,
							newType: newExt,
						}),
					)
					document.body.removeChild(input)
					return
				}
				replaceFileRequest(item, selectedFile)
			}
			document.body.removeChild(input)
		}
		document.body.appendChild(input)
		input.click()
	}

	return {
		handleReplaceFile,
		replaceFileRequest,
		checkFileTypeMatching,
	}
}
