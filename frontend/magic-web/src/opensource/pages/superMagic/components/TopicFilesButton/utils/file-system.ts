// 文件系统 API 类型定义（WebKit File System API）
export interface WebkitFileSystemEntry {
	readonly isFile: boolean
	readonly isDirectory: boolean
	readonly name: string
	readonly fullPath: string
}

export interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
	file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void
}

export interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
	createReader(): WebkitFileSystemDirectoryReader
}

export interface WebkitFileSystemDirectoryReader {
	readEntries(
		successCallback: (entries: WebkitFileSystemEntry[]) => void,
		errorCallback?: (error: Error) => void,
	): void
}

/**
 * 递归获取文件夹内的所有文件，保持完整的目录结构
 *
 * @param dirEntry 目录入口
 * @param parentPath 父路径
 * @returns Promise<File[]> 文件列表，每个文件都包含正确的 webkitRelativePath
 */
export async function getAllFilesFromDirectory(
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
								entry as unknown as WebkitFileSystemDirectoryEntry,
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
export function hasWebkitRelativePath(files: File[]): boolean {
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
export async function detectAndExtractFolderFiles(
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
 * 拖拽项类型
 */
export interface DropItem {
	type: "file" | "folder"
	name: string
	files: File[]
}

/**
 * 处理拖拽项的结果
 */
export interface ProcessDroppedItemsResult {
	standaloneFiles: File[]
	folders: DropItem[]
}

/**
 * 处理混合拖拽（文件+文件夹），将它们分类
 *
 * @param dataTransfer 拖拽数据传输对象
 * @param debug 是否启用调试模式
 * @returns Promise<ProcessDroppedItemsResult> 包含单独的文件和文件夹列表
 */
export async function processDroppedItems(
	dataTransfer: DataTransfer,
	debug = false,
): Promise<ProcessDroppedItemsResult> {
	const standaloneFiles: File[] = []
	const folders: DropItem[] = []

	if (!dataTransfer.items || dataTransfer.items.length === 0) {
		// 降级处理：如果没有 items API，使用 files
		if (dataTransfer.files.length > 0) {
			standaloneFiles.push(...Array.from(dataTransfer.files))
		}
		return { standaloneFiles, folders }
	}

	try {
		if (debug) {
			console.log(
				`🔍 开始处理拖拽项，共 ${dataTransfer.items.length} 个 items，${dataTransfer.files.length} 个 files`,
			)
		}

		// 重要：必须在异步操作前保存所有 items 和 entries
		// 因为在异步操作期间，dataTransfer.items 会被浏览器清空，
		// 而且 item 对象的属性也会被重置，webkitGetAsEntry() 也会失效
		interface ItemInfo {
			item: DataTransferItem
			entry: WebkitFileSystemEntry | null
			kind: string
			type: string
		}

		const itemInfos: ItemInfo[] = []
		for (let i = 0; i < dataTransfer.items.length; i++) {
			const item = dataTransfer.items[i]
			const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null
			itemInfos.push({
				item,
				entry,
				kind: item.kind,
				type: item.type,
			})
		}

		if (debug) {
			console.log(`📋 已保存 ${itemInfos.length} 个 items 到数组`)
		}

		// 遍历所有拖拽项（使用保存的数组）
		for (let i = 0; i < itemInfos.length; i++) {
			const itemInfo = itemInfos[i]
			const { item, entry, kind, type } = itemInfo

			if (debug) {
				console.log(`🔍 处理第 ${i + 1} 个 item:`, {
					kind,
					type,
					hasEntry: !!entry,
				})
			}

			// 只处理文件类型的项
			if (kind !== "file") {
				if (debug) {
					console.log(`⏭️ 跳过非文件类型: ${kind}`)
				}
				continue
			}

			// 使用 webkitGetAsEntry 来区分文件和文件夹
			if (entry) {
				if (debug) {
					console.log(`🔍 Entry 信息:`, {
						name: entry.name,
						isFile: entry.isFile,
						isDirectory: entry.isDirectory,
					})
				}

				if (entry.isDirectory) {
					// 处理文件夹
					if (debug) {
						console.log(`📁 检测到文件夹: "${entry.name}"，开始递归读取...`)
					}

					const folderFiles = await getAllFilesFromDirectory(
						entry as unknown as WebkitFileSystemDirectoryEntry,
						entry.name,
					)

					folders.push({
						type: "folder",
						name: entry.name,
						files: folderFiles,
					})

					if (debug) {
						console.log(`📁 文件夹 "${entry.name}" 包含 ${folderFiles.length} 个文件`)
					}
				} else if (entry.isFile) {
					// 处理单独的文件
					if (debug) {
						console.log(`📄 开始读取单独文件: "${entry.name}"`)
					}

					const fileEntry = entry as unknown as WebkitFileSystemFileEntry
					const file = await new Promise<File>((resolve, reject) => {
						fileEntry.file(resolve, reject)
					})

					standaloneFiles.push(file)

					if (debug) {
						console.log(`📄 成功读取单独文件: "${file.name}"`)
					}
				} else {
					if (debug) {
						console.log(`⚠️ Entry 既不是文件也不是文件夹:`, {
							name: entry.name,
							isFile: entry.isFile,
							isDirectory: entry.isDirectory,
						})
					}
				}
			} else {
				// 降级处理：如果不支持 webkitGetAsEntry，直接使用 getAsFile
				const file = item.getAsFile()
				if (file) {
					standaloneFiles.push(file)
					if (debug) {
						console.log(`📄 检测到文件（降级模式）: "${file.name}"`)
					}
				} else {
					if (debug) {
						console.log(`⚠️ getAsFile 返回 null`)
					}
				}
			}

			if (debug) {
				console.log(`✅ 第 ${i + 1} 个 item 处理完成`)
			}
		}

		if (debug) {
			console.log(`🔄 循环结束，共处理 ${itemInfos.length} 个 items`)
		}

		if (debug) {
			console.log("📦 拖拽项处理完成:", {
				standaloneFilesCount: standaloneFiles.length,
				foldersCount: folders.length,
				totalFiles:
					standaloneFiles.length + folders.reduce((sum, f) => sum + f.files.length, 0),
			})
		}
	} catch (error) {
		console.error("处理拖拽项时出错:", error)
		throw error
	}

	return { standaloneFiles, folders }
}
