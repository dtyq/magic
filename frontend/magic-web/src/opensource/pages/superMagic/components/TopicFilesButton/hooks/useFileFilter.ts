import { useMemo, useState } from "react"
import type { AttachmentItem } from "./types"

interface FileFilters {
	documents: boolean
	multimedia: boolean
	code: boolean
}

interface UseFileFilterOptions {
	attachments: AttachmentItem[]
	fileFilters: FileFilters
	externalSearchValue?: string
}

// 文件类型分类
const FILE_TYPES = {
	documents: ["pdf", "doc", "docx", "txt", "md", "csv", "xlsx", "xls"],
	multimedia: ["jpg", "jpeg", "png", "gif", "mp4", "mp3", "wav", "avi", "mov"],
	code: ["js", "ts", "tsx", "jsx", "py", "java", "cpp", "c", "go", "rust", "html", "css"],
}

/**
 * useFileFilter - 处理文件过滤功能
 */
export function useFileFilter(options: UseFileFilterOptions) {
	const { attachments, fileFilters, externalSearchValue } = options

	// 搜索状态
	const [searchValue, setSearchValue] = useState("")

	// 使用外部搜索值（如果提供）否则使用内部搜索值
	const effectiveSearchValue =
		externalSearchValue !== undefined ? externalSearchValue : searchValue

	// 获取文件类型分类
	const getFileTypeCategory = (extension?: string) => {
		if (!extension) return null
		if (FILE_TYPES.documents.includes(extension)) return "documents"
		if (FILE_TYPES.multimedia.includes(extension)) return "multimedia"
		if (FILE_TYPES.code.includes(extension)) return "code"
		return null
	}

	// 收集匹配项及其父级路径
	const matchedItemPaths = useMemo(() => {
		const paths: string[] = []

		if (!effectiveSearchValue.trim()) return paths

		const collectPaths = (items: AttachmentItem[], parentPath: string[] = []) => {
			for (const item of items) {
				const itemId = item.file_id || ""
				const currentPath = [...parentPath, itemId]

				if (item.is_directory && "children" in item) {
					// 检查文件夹名称是否匹配
					const folderNameMatch = (item.name || "")
						.toLowerCase()
						.includes(effectiveSearchValue.toLowerCase())

					if (folderNameMatch) {
						// 文件夹名称匹配，添加所有父级路径
						paths.push(...parentPath)
					}

					// 递归检查子项
					collectPaths(item.children || [], currentPath)
				} else {
					// 检查文件名是否匹配
					const fileName = item.filename || item.file_name || ""
					const fileNameMatch = fileName
						.toLowerCase()
						.includes(effectiveSearchValue.toLowerCase())

					if (fileNameMatch) {
						// 文件名匹配，添加所有父级路径
						paths.push(...parentPath)
					}
				}
			}
		}

		collectPaths(attachments)
		// 去重
		return Array.from(new Set(paths))
	}, [attachments, effectiveSearchValue])

	// 过滤后的文件列表
	const filteredFiles = useMemo(() => {
		if (!attachments) return []

		const filterItems = (items: AttachmentItem[]): AttachmentItem[] => {
			return items
				.filter((item) => {
					// 首先检查项目是否隐藏
					if (item.is_hidden) return false

					// 检查是否为文件夹
					if (item.is_directory && "children" in item) {
						// 搜索文件夹名称
						const folderMatch =
							!effectiveSearchValue.trim() ||
							(item.name || "")
								.toLowerCase()
								.includes(effectiveSearchValue.toLowerCase())

						// 递归搜索子文件/文件夹
						const filteredChildren = filterItems(item.children || [])

						// 如果名称匹配或有匹配的子项，则保留该文件夹
						return folderMatch || filteredChildren.length > 0
					} else {
						// 搜索和过滤文件
						const fileName = item.filename || item.file_name || ""
						const fileMatch =
							!effectiveSearchValue.trim() ||
							fileName.toLowerCase().includes(effectiveSearchValue.toLowerCase())

						// 如果搜索不匹配，直接返回false
						if (!fileMatch) return false

						// 文件类型过滤
						if (item.file_extension) {
							const category = getFileTypeCategory(item.file_extension)
							// 过滤掉被取消选择的类别的文件
							if (category && !fileFilters[category]) {
								return false
							}
						}

						return true
					}
				})
				.map((item) => {
					// 如果是文件夹，需要递归过滤子项
					if (item.is_directory && "children" in item) {
						// 检查文件夹名称是否匹配
						const folderNameMatch =
							!effectiveSearchValue.trim() ||
							(item.name || "")
								.toLowerCase()
								.includes(effectiveSearchValue.toLowerCase())

						// 如果文件夹名称匹配，保留所有子项（不再次过滤）
						// 如果文件夹名称不匹配，说明是因为子项匹配才保留的，需要过滤子项
						return {
							...item,
							children: folderNameMatch
								? item.children || []
								: filterItems(item.children || []),
						}
					}
					return item
				})
		}

		return filterItems(attachments)
	}, [attachments, effectiveSearchValue, fileFilters])

	// 重置搜索状态
	const resetFilter = () => {
		setSearchValue("")
	}

	return {
		// 搜索状态
		searchValue,
		setSearchValue,

		// 计算值
		filteredFiles,
		matchedItemPaths,

		// 工具函数
		getFileTypeCategory,
		resetFilter,
	}
}
