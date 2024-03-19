import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

// 文件系统 API 类型定义（WebKit File System API）
interface WebkitFileSystemEntry {
	readonly isFile: boolean
	readonly isDirectory: boolean
	readonly name: string
	readonly fullPath: string
}

interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
	file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void
}

interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
	createReader(): WebkitFileSystemDirectoryReader
}

interface WebkitFileSystemDirectoryReader {
	readEntries(
		successCallback: (entries: WebkitFileSystemEntry[]) => void,
		errorCallback?: (error: Error) => void,
	): void
}

// 拖拽上传配置选项
interface UseFolderDragUploadOptions {
	/** 是否允许编辑/上传 */
	allowEdit?: boolean
	/** 项目信息 */
	selectedProject?: { id: string }
	/** 文件上传完成后的回调 */
	onFilesSelected: (files: File[], isUploadingFolder: boolean) => void
	/** 是否启用调试模式 */
	debug?: boolean
}

interface UseFolderDragUploadReturn {
	/** 拖拽状态 */
	isDragOver: boolean
	/** 拖拽事件处理器 */
	dragEvents: {
		onDragEnter: (e: React.DragEvent) => void
		onDragLeave: (e: React.DragEvent) => void
		onDragOver: (e: React.DragEvent) => void
		onDrop: (e: React.DragEvent) => void
	}
}

/**
 * 递归获取文件夹内的所有文件，保持完整的目录结构
 *
 * @param dirEntry 目录入口
 * @param parentPath 父路径
 * @returns Promise<File[]> 文件列表，每个文件都包含正确的 webkitRelativePath
 */
async function getAllFilesFromDirectory(
	dirEntry: WebkitFileSystemDirectoryEntry,
	parentPath = "",
): Promise<File[]> {
	const files: File[] = []

	return new Promise((resolve, reject) => {
		const dirReader = dirEntry.createReader()

		function readEntries() {
			dirReader.readEntries(async (entries) => {
				if (entries.length === 0) {
					resolve(files)
					return
				}

				try {
					const promises = entries.map(async (entry) => {
						// 构建完整的相对路径（从文件夹根目录开始）
						const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name

						if (entry.isFile) {
							const fileEntry = entry as WebkitFileSystemFileEntry
							const file = await new Promise<File>((resolveFile, rejectFile) => {
								fileEntry.file((originalFile) => {
									// 创建一个新的 File 对象，设置正确的 webkitRelativePath
									const enhancedFile = new File(
										[originalFile],
										originalFile.name,
										{
											type: originalFile.type,
											lastModified: originalFile.lastModified,
										},
									)

									// 设置 webkitRelativePath 属性以保持文件夹结构
									Object.defineProperty(enhancedFile, "webkitRelativePath", {
										value: fullPath,
										writable: false,
										enumerable: true,
										configurable: true,
									})

									resolveFile(enhancedFile)
								}, rejectFile)
							})
							return [file]
						} else if (entry.isDirectory) {
							// 递归处理子目录
							const subFiles = await getAllFilesFromDirectory(
								entry as WebkitFileSystemDirectoryEntry,
								fullPath,
							)
							return subFiles
						}
						return []
					})

					const results = await Promise.all(promises)
					files.push(...results.flat())

					// 继续读取更多条目（某些浏览器会分批返回）
					readEntries()
				} catch (error) {
					reject(error)
				}
			}, reject)
		}

		readEntries()
	})
}

/**
 * 检测文件是否来自文件夹拖拽
 *
 * @param files 文件列表
 * @returns boolean 是否包含webkitRelativePath
 */
function hasWebkitRelativePath(files: File[]): boolean {
	return files.some((file) => {
		const webkitRelativePath = (file as File & { webkitRelativePath?: string })
			.webkitRelativePath
		return webkitRelativePath && webkitRelativePath.trim() !== ""
	})
}

/**
 * 从DataTransfer.items检测并获取文件夹内容
 *
 * @param dataTransfer 拖拽数据传输对象
 * @param debug 是否启用调试模式
 * @returns Promise<{hasDirectory: boolean, folderFiles: File[]}>
 */
async function detectAndExtractFolderFiles(
	dataTransfer: DataTransfer,
	debug = false,
): Promise<{ hasDirectory: boolean; folderFiles: File[] }> {
	let hasDirectory = false
	let folderFiles: File[] = []

	if (!dataTransfer.items || dataTransfer.items.length === 0) {
		return { hasDirectory, folderFiles }
	}

	try {
		for (let i = 0; i < dataTransfer.items.length; i++) {
			const item = dataTransfer.items[i]
			if (item.webkitGetAsEntry) {
				const entry = item.webkitGetAsEntry()
				if (entry && entry.isDirectory) {
					hasDirectory = true
					if (debug) {
						console.log(`📁 开始递归获取文件夹 "${entry.name}" 内的所有文件...`)
					}

					// 递归获取文件夹内的所有文件，传递文件夹名作为根路径
					folderFiles = await getAllFilesFromDirectory(
						entry as unknown as WebkitFileSystemDirectoryEntry,
						entry.name,
					)

					if (debug) {
						console.log(
							`📁 文件夹 "${entry.name}" 内共找到 ${folderFiles.length} 个文件`,
						)

						// 验证文件路径设置
						if (folderFiles.length > 0) {
							console.log("📁 文件夹结构预览:")
							const pathSample = folderFiles.slice(0, 5).map((f) => ({
								name: f.name,
								relativePath: (f as File & { webkitRelativePath?: string })
									.webkitRelativePath,
							}))
							console.table(pathSample)
						}
					}
					break
				}
			}
		}
	} catch (error) {
		console.error("检测DataTransfer.items时出错:", error)
		throw error
	}

	return { hasDirectory, folderFiles }
}

/**
 * 文件夹拖拽上传 Hook
 *
 * 支持以下功能：
 * 1. 检测文件和文件夹拖拽
 * 2. 递归获取文件夹内所有文件
 * 3. 保持完整的目录结构关系
 * 4. 权限和错误处理
 *
 * @param options 配置选项
 * @returns 拖拽状态和事件处理器
 */
export function useFolderDragUpload({
	allowEdit = true,
	selectedProject,
	onFilesSelected,
	debug = false,
}: UseFolderDragUploadOptions): UseFolderDragUploadReturn {
	const { t } = useTranslation("super")

	// 处理拖拽文件上传的核心逻辑
	const handleFilesDropped = useCallback(
		async (files: FileList, dataTransfer: DataTransfer) => {
			// 权限检查
			if (!allowEdit) {
				magicToast.warning(t("topicFiles.contextMenu.noEditPermission", "没有编辑权限"))
				return
			}

			const fileArray = Array.from(files)

			// 空文件检查
			if (fileArray.length === 0) {
				magicToast.warning(t("topicFiles.contextMenu.noFilesSelected", "未选择任何文件"))
				return
			}

			// 项目检查
			if (!selectedProject?.id) {
				magicToast.warning(t("topicFiles.contextMenu.projectRequired", "请先选择项目"))
				return
			}

			try {
				// 检查是否为文件夹拖拽：使用多种方法检测
				let isUploadingFolder = false
				let finalFileArray = fileArray

				// 方法1：检查webkitRelativePath（针对通过 input[webkitdirectory] 选择的文件）
				const hasWebkitPath = hasWebkitRelativePath(fileArray)

				// 方法2：检查DataTransfer.items中的Entry类型并递归获取文件
				const { hasDirectory, folderFiles } = await detectAndExtractFolderFiles(
					dataTransfer,
					debug,
				)

				isUploadingFolder = hasWebkitPath || hasDirectory

				// 如果检测到文件夹且从DataTransfer.items获取到了文件，使用获取到的文件列表
				if (hasDirectory && folderFiles.length > 0) {
					finalFileArray = folderFiles
					if (debug) {
						console.log("使用递归获取的文件列表，共", folderFiles.length, "个文件")
					}
				}

				// 调试信息
				if (debug) {
					console.log("=== 拖拽文件检测 ===")
					console.log("原始文件数量:", fileArray.length)
					console.log("最终文件数量:", finalFileArray.length)
					console.log("webkitRelativePath检测:", hasWebkitPath)
					console.log("DataTransfer.items检测:", hasDirectory)
					console.log("是否为文件夹上传:", isUploadingFolder)

					if (finalFileArray.length <= 10) {
						console.log(
							"文件信息:",
							finalFileArray.map((f) => ({
								name: f.name,
								size: f.size,
								webkitRelativePath:
									(f as File & { webkitRelativePath?: string })
										.webkitRelativePath || "无",
							})),
						)
					} else {
						console.log(
							"文件过多，只显示前3个:",
							finalFileArray.slice(0, 3).map((f) => f.name),
						)
					}
					console.log("===================")
				}

				onFilesSelected(finalFileArray, isUploadingFolder)
			} catch (error) {
				console.error("Error handling file selection:", error)
				magicToast.error(t("topicFiles.contextMenu.uploadError", "文件处理失败"))
			}
		},
		[allowEdit, selectedProject?.id, onFilesSelected, t, debug],
	)

	// 拖拽状态管理
	const [isDragOver, setIsDragOver] = useState(false)

	// 拖拽事件处理器 - 专门用于文件上传，优先处理 application/json
	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()

		// 检查是否为内部文件移动，如果是则不显示拖拽覆盖层
		if (e.dataTransfer.types.includes("application/json")) {
			// 可能是内部文件移动，暂时不显示覆盖层，等drop事件时再确认
			return
		}

		setIsDragOver(true)
	}, [])

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragOver(false)
		}
	}, [])

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()

			// 检查是否为内部文件移动，如果是则不显示拖拽覆盖层
			if (e.dataTransfer.types.includes("application/json")) {
				// 可能是内部文件移动，不显示覆盖层
				return
			}

			if (!isDragOver) {
				setIsDragOver(true)
			}
		},
		[isDragOver],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragOver(false)

			// 1. 优先检查是否有内部文件移动数据
			const jsonData = e.dataTransfer.getData("application/json")
			if (jsonData) {
				try {
					const parsedData = JSON.parse(jsonData)
					if (parsedData.type === "file-move") {
						// 这是内部文件移动，不是外部文件上传，直接返回
						if (debug) {
							console.log("检测到内部文件移动，跳过文件上传处理")
						}
						return
					}
				} catch (error) {
					console.error("Error parsing JSON drag data:", error)
				}
			}

			// 2. 如果没有自定义数据，检查是否有文件
			if (e.dataTransfer.files.length > 0) {
				handleFilesDropped(e.dataTransfer.files, e.dataTransfer)
			}
		},
		[handleFilesDropped, debug],
	)

	// 构建拖拽事件对象
	const dragEvents = useMemo(
		() => ({
			onDragEnter: handleDragEnter,
			onDragLeave: handleDragLeave,
			onDragOver: handleDragOver,
			onDrop: handleDrop,
		}),
		[handleDragEnter, handleDragLeave, handleDragOver, handleDrop],
	)

	return useMemo(
		() => ({
			isDragOver,
			dragEvents,
		}),
		[isDragOver, dragEvents],
	)
}
