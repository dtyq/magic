import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { last } from "lodash-es"
import { SuperMagicApi } from "@/opensource/apis"
import type { AttachmentItem } from "../../TopicFilesButton/hooks"
import { getItemId, getItemName } from "../utils/attachmentUtils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseCreateDirectoryOptions {
	projectId: string
	path: AttachmentItem[]
	directories: AttachmentItem[]
	onCreateDirectory?: (data: { id: string; projectId: string; parentId: string }) => void
	onDirectoryCreated?: (newDirectory: AttachmentItem, newPath: AttachmentItem[]) => Promise<void>
}

export function useCreateDirectory(options: UseCreateDirectoryOptions) {
	const { t } = useTranslation("super")
	const { projectId, path, directories, onCreateDirectory, onDirectoryCreated } = options

	const [createDirectoryShown, setCreateDirectoryShown] = useState(false)
	const [createDirectoryName, setCreateDirectoryName] = useState("")
	const [createDirectoryErrorMessage, setCreateDirectoryErrorMessage] = useState("")
	const [loading, setLoading] = useState(false)

	const showCreateDirectory = useMemoizedFn(() => {
		if (createDirectoryShown) {
			magicToast.info(t("selectPathModal.completeFolderCreation"))
			return
		}
		setCreateDirectoryShown(true)
		setCreateDirectoryName(t("selectPathModal.defaultFolderName"))
		setCreateDirectoryErrorMessage("")
	})

	const cancelCreateDirectory = useMemoizedFn(() => {
		setCreateDirectoryShown(false)
		setCreateDirectoryErrorMessage("")
	})

	const submitCreateDirectory = useMemoizedFn(async () => {
		const normalizedName = createDirectoryName.trim()
		if (!normalizedName) {
			setCreateDirectoryErrorMessage(t("selectPathModal.enterSubfolderName"))
			return
		}

		// 重名校验（仅在当前目录、仅目录）
		const isDuplicate = directories.some(
			(dir) => dir.is_directory && getItemName(dir).trim() === normalizedName,
		)
		if (isDuplicate) {
			setCreateDirectoryErrorMessage(t("topicFiles.contextMenu.newFolder.duplicateError"))
			return
		}

		const currentDirectory = last(path)
		setLoading(true)

		try {
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: currentDirectory ? getItemId(currentDirectory) : "",
				file_name: normalizedName,
				is_directory: true,
			})

			if (response) {
				magicToast.success(t("selectPathModal.createdSuccessfully"))

				// 创建子文件夹的回调
				onCreateDirectory &&
					onCreateDirectory({
						id: response.file_id || `new_${Date.now()}`,
						projectId: projectId,
						parentId: currentDirectory ? getItemId(currentDirectory) : "",
					})

				// 重置创建文件夹相关状态
				setCreateDirectoryErrorMessage("")
				setCreateDirectoryShown(false)

				// 自动进入新创建的文件夹
				const newPath = [...path, response]
				if (onDirectoryCreated) {
					await onDirectoryCreated(response, newPath)
				}
			}
		} catch (error) {
			console.error("Failed to create directory:", error)
			setCreateDirectoryErrorMessage("Failed to create directory")
		}

		setLoading(false)
	})

	const onCreateDirectoryInputKeyDown = useMemoizedFn(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			e.stopPropagation()
			if (e.key === "Escape") {
				e.stopPropagation()
				cancelCreateDirectory()
			}
		},
	)

	const onCreateDirectoryInputChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		setCreateDirectoryName(e.target.value || "")
		setCreateDirectoryErrorMessage("")
	})

	const onCreateDirectoryInputFocus = useMemoizedFn((e: React.FocusEvent<HTMLInputElement>) => {
		// 全选默认文本，方便用户直接输入新名称
		e.target.select()
	})

	return {
		createDirectoryShown,
		createDirectoryName,
		createDirectoryErrorMessage,
		showCreateDirectory,
		cancelCreateDirectory,
		submitCreateDirectory,
		onCreateDirectoryInputKeyDown,
		onCreateDirectoryInputChange,
		onCreateDirectoryInputFocus,
		loading,
	}
}
