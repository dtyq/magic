import { useState, useRef, useEffect } from "react"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { last } from "lodash-es"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import type { ViewMode } from "../../../types"
import { searchInAttachments, getItemId } from "../../../utils/attachmentUtils"

interface UseSearchOptions {
	viewMode: ViewMode
	attachments: AttachmentItem[]
	path: AttachmentItem[]
	filesSort: (files: AttachmentItem[]) => AttachmentItem[]
	setDirectories: (directories: AttachmentItem[]) => void
	setLoading: (loading: boolean) => void
	fetchDirectories: (params: {
		projectId: string
		parentId?: string
		pathOverride?: AttachmentItem[]
	}) => Promise<void>
}

export function useSearch(options: UseSearchOptions) {
	const { viewMode, attachments, path, filesSort, setDirectories, setLoading, fetchDirectories } =
		options
	const { t } = useTranslation("super")

	const [isSearch, setIsSearch] = useState(false)
	const [fileName, setFileName] = useState("")
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)

	const searchPlaceholder =
		viewMode === "workspace"
			? t("selectPathModal.searchWorkspace")
			: viewMode === "project"
				? t("selectPathModal.searchProject")
				: t("selectPathModal.searchDirectory")

	const { run: fetchFiles } = useDebounceFn(
		async (params: { value: string; projectId: string }) => {
			if (!params.value) {
				setIsSearch(false)
				const lastPath = last(path)
				await fetchDirectories({
					projectId: params.projectId,
					parentId: lastPath ? getItemId(lastPath) : undefined,
				})
				return
			}

			setIsSearch(true)
			setLoading(true)

			try {
				const searchResults = searchInAttachments(attachments, params.value)
				setDirectories(filesSort(searchResults))
			} catch (error) {
				console.error("Failed to search files:", error)
				setDirectories([])
			}
			setLoading(false)
		},
		{ wait: 400 },
	)

	const searchWorkspaces = useMemoizedFn((value: string) => {
		setFileName(value)
		if (!value.trim()) {
			setIsSearch(false)
			return
		}
		setIsSearch(true)
	})

	const searchProjects = useMemoizedFn((value: string) => {
		setFileName(value)
		if (!value.trim()) {
			setIsSearch(false)
			return
		}
		setIsSearch(true)
	})

	const searchDirectories = useMemoizedFn(
		async (e: React.ChangeEvent<HTMLInputElement>, projectId?: string) => {
			const value = e.currentTarget.value
			setFileName(value)

			if (viewMode === "workspace") {
				searchWorkspaces(value)
			} else if (viewMode === "project") {
				searchProjects(value)
			} else if (viewMode === "directory" && projectId) {
				fetchFiles({
					value,
					projectId,
				})
			}
		},
	)

	const handleToggleSearch = useMemoizedFn((onBackToNormal?: () => void) => {
		if (isSearchOpen) {
			setIsSearchOpen(false)
			onBackToNormal?.()
			return
		}
		setIsSearchOpen(true)
	})

	const backCatalogueSelect = useMemoizedFn(
		async (params?: { projectId?: string; parentId?: string }) => {
			setFileName("")
			setIsSearch(false)
			setIsSearchOpen(false)

			if (viewMode === "directory" && params?.projectId) {
				await fetchDirectories({
					projectId: params.projectId,
					parentId: params.parentId,
				})
			}
		},
	)

	const clearSearch = useMemoizedFn(() => {
		setFileName("")
		setIsSearch(false)
		setIsSearchOpen(false)
	})

	useEffect(() => {
		if (isSearchOpen) {
			searchInputRef.current?.focus()
		}
	}, [isSearchOpen])

	return {
		isSearch,
		fileName,
		isSearchOpen,
		searchInputRef,
		searchPlaceholder,
		searchDirectories,
		handleToggleSearch,
		backCatalogueSelect,
		clearSearch,
		setFileName,
		setIsSearch,
		setIsSearchOpen,
	}
}
