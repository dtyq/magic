import { useMemoizedFn, useUpdateEffect } from "ahooks"

import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { useDirectoryNavigation } from "./useDirectoryNavigation"
import { useDirectorySearch } from "./useDirectorySearch"
import { useCreateDirectory } from "./useCreateDirectory"
import { useUploadFiles } from "./useUploadFiles"

interface UseUploadModalProps {
	projectId: string
	attachments: AttachmentItem[]
	defaultPath: AttachmentItem[]
	visible: boolean
	uploadFiles?: File[]
	fileType: string[]
	onCreateDirectory?: (params: { id: string; projectId: string; parentId: string }) => void
	validateFileSize?: (files: File[]) => { validFiles: File[]; hasWarning: boolean }
	validateFileCount?: (files: File[]) => { validFiles: File[]; hasError: boolean }
}

export function useUploadModal({
	projectId,
	attachments,
	defaultPath,
	visible,
	uploadFiles,
	fileType,
	onCreateDirectory,
	validateFileSize,
	validateFileCount,
}: UseUploadModalProps) {
	// Directory navigation
	const {
		loading: navigationLoading,
		path,
		directories,
		setDirectories,
		fetchDirectories,
		navigateToDirectory,
		navigateToBreadcrumb,
		resetNavigation,
	} = useDirectoryNavigation({
		projectId,
		attachments,
		defaultPath,
		visible,
	})

	// Directory search
	const {
		isSearch,
		fileName,
		loading: searchLoading,
		handleSearchChange,
		handleCompositionStart,
		handleCompositionEnd,
		exitSearchMode,
		resetSearch,
	} = useDirectorySearch({
		projectId,
		attachments,
		fileType,
		path,
		fetchDirectories,
		setDirectories,
	})

	// Create directory
	const {
		createDirectoryShown,
		createDirectoryName,
		createDirectoryErrorMessage,
		loading: createLoading,
		showCreateDirectory,
		cancelCreateDirectory,
		submitCreateDirectory,
		handleInputChange: handleCreateDirectoryInputChange,
		handleInputFocus: handleCreateDirectoryInputFocus,
		handleInputKeyDown: handleCreateDirectoryInputKeyDown,
		resetCreateDirectory,
	} = useCreateDirectory({
		projectId,
		path,
		directories,
		setDirectories,
		onCreateDirectory,
	})

	// Upload files
	const { fileList, addFiles, removeFile, updateFileName, clearFiles, resetFiles } =
		useUploadFiles({ uploadFiles, validateFileSize, validateFileCount })

	// Combined loading state
	const loading = navigationLoading || searchLoading || createLoading

	// Reset all states
	const resetState = useMemoizedFn(() => {
		resetNavigation()
		resetSearch()
		resetCreateDirectory()
		resetFiles()
	})

	// Reset when modal is hidden
	useUpdateEffect(() => {
		if (!visible) {
			resetState()
		}
	}, [visible])

	// Directory click handler
	const handleDirectoryClick = useMemoizedFn(async (item: AttachmentItem) => {
		exitSearchMode() // Exit search mode first
		await navigateToDirectory(item)
		cancelCreateDirectory() // Cancel create directory if shown
	})

	// Breadcrumb click handler
	const handleBreadcrumbClick = useMemoizedFn(async (itemId: string) => {
		await navigateToBreadcrumb(itemId)
		cancelCreateDirectory() // Cancel create directory if shown
	})

	return {
		// States
		loading,
		path,
		directories,
		isSearch,
		fileName,
		createDirectoryShown,
		createDirectoryName,
		createDirectoryErrorMessage,
		fileList,

		// Directory navigation
		navigateToDirectory: handleDirectoryClick,
		navigateToBreadcrumb: handleBreadcrumbClick,

		// Search
		handleSearchChange,
		handleCompositionStart,
		handleCompositionEnd,
		exitSearchMode,

		// Create directory
		showCreateDirectory,
		cancelCreateDirectory,
		submitCreateDirectory,
		handleCreateDirectoryInputChange,
		handleCreateDirectoryInputFocus,
		handleCreateDirectoryInputKeyDown,

		// Upload files
		addFiles,
		removeFile,
		updateFileName,
		clearFiles,

		// Reset
		resetState,
	}
}
