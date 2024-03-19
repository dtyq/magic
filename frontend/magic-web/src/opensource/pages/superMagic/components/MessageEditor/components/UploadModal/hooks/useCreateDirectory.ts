import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { last } from "lodash-es"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { getItemId, isDuplicateDirectoryName } from "../utils"
import { SuperMagicApi } from "@/opensource/apis"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseCreateDirectoryProps {
	projectId: string
	path: AttachmentItem[]
	directories: AttachmentItem[]
	setDirectories: (dirs: AttachmentItem[]) => void
	onCreateDirectory?: (params: { id: string; projectId: string; parentId: string }) => void
}

export function useCreateDirectory({
	projectId,
	path,
	directories,
	setDirectories,
	onCreateDirectory,
}: UseCreateDirectoryProps) {
	const { t } = useTranslation("super")

	const [createDirectoryShown, setCreateDirectoryShown] = useState(false)
	const [createDirectoryName, setCreateDirectoryName] = useState("")
	const [createDirectoryErrorMessage, setCreateDirectoryErrorMessage] = useState("")
	const [loading, setLoading] = useState(false)

	// Show create directory input
	const showCreateDirectory = useMemoizedFn(() => {
		if (createDirectoryShown) {
			magicToast.info(t("selectPathModal.completeFolderCreation"))
			return
		}
		setCreateDirectoryShown(true)
		setCreateDirectoryName(t("selectPathModal.defaultFolderName"))
		setCreateDirectoryErrorMessage("")
	})

	// Cancel create directory
	const cancelCreateDirectory = useMemoizedFn(() => {
		setCreateDirectoryShown(false)
		setCreateDirectoryErrorMessage("")
	})

	// Submit create directory
	const submitCreateDirectory = useMemoizedFn(async () => {
		const normalizedName = createDirectoryName.trim()
		if (!normalizedName) {
			setCreateDirectoryErrorMessage(t("selectPathModal.enterSubfolderName"))
			return
		}

		// Check for duplicate names (only in current directory, only directories)
		if (isDuplicateDirectoryName(normalizedName, directories)) {
			setCreateDirectoryErrorMessage(t("topicFiles.contextMenu.newFolder.duplicateError"))
			return
		}

		const currentDirectory = last(path)
		setLoading(true)

		try {
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: getItemId(currentDirectory || {}),
				file_name: normalizedName,
				is_directory: true,
			})

			if (response) {
				magicToast.success(t("selectPathModal.createdSuccessfully"))

				// Callback for creating subdirectory
				onCreateDirectory &&
					onCreateDirectory({
						id: response.file_id || `new_${Date.now()}`,
						projectId: projectId,
						parentId: getItemId(currentDirectory || {}),
					})

				// Add new directory to the front of current directory list
				setDirectories([response, ...directories])
				setCreateDirectoryErrorMessage("")
				setCreateDirectoryShown(false)
			}
		} catch (error) {
			console.error("Failed to create directory:", error)
			setCreateDirectoryErrorMessage("Failed to create directory")
		}

		setLoading(false)
	})

	// Handle input change
	const handleInputChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		setCreateDirectoryName(e.target.value || "")
		setCreateDirectoryErrorMessage("")
	})

	// Handle input focus (select all text)
	const handleInputFocus = useMemoizedFn((e: React.FocusEvent<HTMLInputElement>) => {
		e.target.select()
	})

	// Handle input key down
	const handleInputKeyDown = useMemoizedFn((e: React.KeyboardEvent<HTMLInputElement>) => {
		e.stopPropagation()
		if (e.key === "Escape") {
			e.stopPropagation()
			cancelCreateDirectory()
		}
	})

	// Reset create directory state
	const resetCreateDirectory = useMemoizedFn(() => {
		setCreateDirectoryShown(false)
		setCreateDirectoryName("")
		setCreateDirectoryErrorMessage("")
	})

	return {
		createDirectoryShown,
		createDirectoryName,
		createDirectoryErrorMessage,
		loading,
		showCreateDirectory,
		cancelCreateDirectory,
		submitCreateDirectory,
		handleInputChange,
		handleInputFocus,
		handleInputKeyDown,
		resetCreateDirectory,
	}
}
