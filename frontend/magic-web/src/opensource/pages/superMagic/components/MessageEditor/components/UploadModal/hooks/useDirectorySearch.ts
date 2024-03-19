import { useState, useRef } from "react"
import { useMemoizedFn, useDebounceFn, useDeepCompareEffect } from "ahooks"
import { last } from "lodash-es"

import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { getItemId, searchInAttachments, filterDirectories, sortFiles } from "../utils"

interface UseDirectorySearchProps {
	projectId: string
	attachments: AttachmentItem[]
	fileType: string[]
	path: AttachmentItem[]
	fetchDirectories: (params: {
		projectId: string
		parentId?: string
		pathOverride?: AttachmentItem[]
	}) => Promise<void>
	setDirectories: (dirs: AttachmentItem[]) => void
}

export function useDirectorySearch({
	projectId,
	attachments,
	fileType,
	path,
	fetchDirectories,
	setDirectories,
}: UseDirectorySearchProps) {
	const [isSearch, setIsSearch] = useState(false)
	const [fileName, setFileName] = useState("")
	const [loading, setLoading] = useState(false)

	const isComplete = useRef(false)
	const fetchFilesParamsRef = useRef<any>()

	const [searchAttachments, setSearchAttachments] = useState<AttachmentItem[]>([])

	useDeepCompareEffect(() => {
		const getFlatAttachments = (attachments: AttachmentItem[]): AttachmentItem[] => {
			if (!attachments) return []

			return attachments.flatMap((item) => {
				if (item.is_directory && item.children) {
					return [item, ...getFlatAttachments(item.children || [])]
				}
				return [item]
			})
		}
		setSearchAttachments(getFlatAttachments(attachments))
	}, [attachments])

	// Search files with debounce
	const { run: fetchFiles } = useDebounceFn(
		async (params: { value: string; fileType: string[]; projectId: string }) => {
			fetchFilesParamsRef.current = params
			if (!params.value) {
				// Exit search mode and restore current directory content when search string is empty
				setIsSearch(false)
				await fetchDirectories({
					projectId: params.projectId,
					parentId: getItemId(last(path) || {}),
				})

				setDirectories(sortFiles(filterDirectories(attachments)))

				return
			}

			setIsSearch(true)
			setLoading(true)

			try {
				// Search using attachments data
				const searchResults = searchInAttachments(
					searchAttachments,
					params.value,
					params.fileType,
				)
				if (fetchFilesParamsRef.current?.value !== params.value) return setLoading(false)
				setDirectories(sortFiles(filterDirectories(searchResults)))
			} catch (error) {
				console.error("Failed to search files:", error)
				setDirectories([])
			}
			setLoading(false)
		},
		{ wait: 400 },
	)

	// Handle search input change
	const handleSearchChange = useMemoizedFn(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value
		setFileName(value)

		if (isComplete.current) return
		fetchFiles({
			value,
			fileType,
			projectId,
		})
	})

	// Handle composition start (for IME input)
	const handleCompositionStart = useMemoizedFn(() => {
		isComplete.current = true
	})

	// Handle composition end (for IME input)
	const handleCompositionEnd = useMemoizedFn((e: React.CompositionEvent<HTMLInputElement>) => {
		isComplete.current = false
		const value = (e.target as HTMLInputElement).value

		setFileName(value)
		fetchFiles({
			value,
			fileType,
			projectId,
		})
	})

	// Exit search mode and return to directory navigation
	const exitSearchMode = useMemoizedFn(() => {
		setFileName("")
		setIsSearch(false)
		fetchDirectories({
			projectId,
			parentId: getItemId(last(path) || {}),
		})
	})

	// Reset search state
	const resetSearch = useMemoizedFn(() => {
		setIsSearch(false)
		setFileName("")
		isComplete.current = false
		fetchFilesParamsRef.current = undefined
	})

	return {
		isSearch,
		fileName,
		loading,
		handleSearchChange,
		handleCompositionStart,
		handleCompositionEnd,
		exitSearchMode,
		resetSearch,
	}
}
