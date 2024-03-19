import type { AttachmentItem } from "../hooks/types"
import { collectSelectedItemIds } from "./collectSelectedItemIds"
import { SuperMagicApi } from "@/opensource/apis"
import { isAppEntryFile, findParentFolder } from "./collectFolderFiles"

interface CreateShareHandlerOptions {
	item: AttachmentItem
	selectedItems: Set<string>
	allFiles: AttachmentItem[]
	getItemId: (item: AttachmentItem) => string
	setShareFileInfo: (
		info: {
			fileIds: string[]
			resourceId?: string
			projectName?: string
			defaultOpenFileId?: string
		} | null,
	) => void
	setShareModalVisible: (visible: boolean) => void
	onCheckingStart?: () => void
	onCheckingEnd?: () => void
	onShowSuccessModal?: (shareInfo: any, fileInfo: AttachmentItem) => void
	onShowSimilarSharesDialog?: (similarShares: any[], fileIds: string[]) => void
}

/**
 * 处理入口文件的分享逻辑
 * 如果是特殊文件夹的入口文件（index.html 且 metadata.type 不为空），
 * 则返回父文件夹的 file_id，分享时只需传递文件夹ID即可
 */
function handleEntryFileShare(item: AttachmentItem, allFiles: AttachmentItem[]): string | null {
	// 检查是否是入口文件
	if (!isAppEntryFile(item)) {
		return null
	}

	// 查找父文件夹
	const parentFolder = findParentFolder(allFiles, item.file_id || "")
	if (!parentFolder) {
		return null
	}

	// 返回父文件夹的 file_id
	return parentFolder.file_id || null
}

/**
 * 创建分享处理函数的核心逻辑
 * 遵循"在外边勾选了谁，文件分享弹层就默认显示谁"的原则
 * 单选文件时使用单文件分享模式，多选文件时使用多文件分享模式
 * 单文件分享会先检测是否已存在分享
 * 特殊处理：如果是入口文件（index.html 且带有 metadata.type），自动分享整个父文件夹
 */
export async function createShareHandler(options: CreateShareHandlerOptions): Promise<void> {
	const {
		item,
		selectedItems,
		allFiles,
		getItemId,
		setShareFileInfo,
		setShareModalVisible,
		onCheckingStart,
		onCheckingEnd,
		onShowSimilarSharesDialog,
	} = options

	if (!getItemId) return

	const clickedItemId = item.file_id || ""

	// 如果有选中的文件，只收集被直接选中的项目ID（包括文件夹），不递归展开
	if (selectedItems.size > 0 && allFiles) {
		const selectedFileIds = collectSelectedItemIds(allFiles, selectedItems, getItemId)

		// 确保被右键的文件也在列表中
		if (clickedItemId && !selectedFileIds.includes(clickedItemId)) {
			selectedFileIds.push(clickedItemId)
		}

		// 检查选中的文件中是否包含入口文件，如果是则替换为父文件夹ID
		const finalFileIds: string[] = []
		const processedIds = new Set<string>()

		selectedFileIds.forEach((fileId) => {
			if (processedIds.has(fileId)) return

			const fileItem = findFileById(allFiles, fileId)
			if (fileItem) {
				const parentFolderId = handleEntryFileShare(fileItem, allFiles)
				if (parentFolderId) {
					// 是入口文件，使用父文件夹ID
					if (!finalFileIds.includes(parentFolderId)) {
						finalFileIds.push(parentFolderId)
					}
					processedIds.add(fileId)
				} else {
					// 不是入口文件，使用原ID
					finalFileIds.push(fileId)
					processedIds.add(fileId)
				}
			}
		})

		// 如果收集到了文件ID，设置分享信息
		if (finalFileIds.length > 0) {
			// 检查是否存在相似分享（单文件和多文件都检查）
			onCheckingStart?.()
			try {
				const similarShares = await SuperMagicApi.findSimilarShares({
					file_ids: finalFileIds,
				})

				if (similarShares && similarShares.length > 0) {
					onCheckingEnd?.()
					// 显示相似分享选择弹窗
					onShowSimilarSharesDialog?.(similarShares, finalFileIds)
					return
				}
			} catch (error) {
				console.error("Check similar shares failed:", error)
			} finally {
				onCheckingEnd?.()
			}

			setShareFileInfo({
				fileIds: finalFileIds,
			})
			setShareModalVisible(true)
			return
		}
	}

	// 如果没有选中的文件，只分享当前文件 - 这是单文件分享
	if (clickedItemId) {
		// 检查当前文件是否是入口文件，如果是则使用父文件夹ID
		const parentFolderId = handleEntryFileShare(item, allFiles)
		const finalFileId = parentFolderId || clickedItemId
		const finalFileIds = [finalFileId]

		// 检查是否存在相似分享
		onCheckingStart?.()
		try {
			const similarShares = await SuperMagicApi.findSimilarShares({ file_ids: finalFileIds })

			if (similarShares && similarShares.length > 0) {
				onCheckingEnd?.()
				// 显示相似分享选择弹窗
				onShowSimilarSharesDialog?.(similarShares, finalFileIds)
				return
			}
		} catch (error) {
			console.error("Check similar shares failed:", error)
		} finally {
			onCheckingEnd?.()
		}

		setShareFileInfo({
			fileIds: finalFileIds,
		})
		setShareModalVisible(true)
	}
}

/**
 * 在文件树中查找指定ID的文件
 */
function findFileById(files: AttachmentItem[], fileId: string): AttachmentItem | null {
	for (const file of files) {
		if (file.file_id === fileId) {
			return file
		}
		if (file.is_directory && file.children) {
			const found = findFileById(file.children, fileId)
			if (found) {
				return found
			}
		}
	}
	return null
}
