import { useRef, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useUpdateEffect } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"
import type { InputRef } from "antd"
import type { AttachmentItem } from "./types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { validateFilename } from "@/utils/filename-validator"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"
import { SuperMagicApi } from "@/apis"

export interface UseRenameOptions {
	projectId?: string
	onRenameSuccess?: (itemId: string, newName: string) => void
	onRenameError?: (error: any) => void
	onUpdateAttachments?: () => void
	// 添加直接更新attachments的回调
	attachments?: AttachmentItem[]
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
}

// 工具函数：更新子项的 relative_file_path（递归处理）
const updateChildrenPaths = (
	children: AttachmentItem[],
	oldFolderPath: string,
	newFolderPath: string,
): AttachmentItem[] => {
	return children.map((child) => {
		const updatedChild: AttachmentItem = { ...child }

		// 更新子项的 relative_file_path
		if (child.relative_file_path && child.relative_file_path.startsWith(oldFolderPath)) {
			updatedChild.relative_file_path = child.relative_file_path.replace(
				oldFolderPath,
				newFolderPath,
			)
		}

		// 如果子项是文件夹，递归更新其子项
		if (child.is_directory && child.children) {
			updatedChild.children = updateChildrenPaths(
				child.children,
				oldFolderPath,
				newFolderPath,
			)
		}

		return updatedChild
	})
}

// 工具函数：在attachments中更新指定ID的文件/文件夹名称和路径
const updateItemNameInAttachments = (
	attachments: AttachmentItem[],
	targetId: string,
	newName: string,
): AttachmentItem[] => {
	return attachments.map((item) => {
		const itemId = item.file_id || (item as any).id

		// 如果是目标项目，更新名称和路径
		if (itemId === targetId) {
			if (item.is_directory) {
				// 文件夹：更新文件夹自身和所有子项的路径
				const oldPath = item.relative_file_path || item.name || ""
				let newPath = oldPath

				// 计算新的 relative_file_path
				// 文件夹格式："/A/" 或 "/A/B/"
				if (oldPath) {
					// 去掉末尾的斜杠，找到倒数第二个斜杠的位置
					const pathWithoutTrailingSlash = oldPath.endsWith("/")
						? oldPath.slice(0, -1)
						: oldPath
					const lastSlashIndex = pathWithoutTrailingSlash.lastIndexOf("/")

					if (lastSlashIndex >= 0) {
						// 获取父路径（包括斜杠）
						const parentPath = pathWithoutTrailingSlash.substring(0, lastSlashIndex + 1)
						// 新路径 = 父路径 + 新名称 + 末尾斜杠
						newPath = parentPath + newName + "/"
					} else {
						// 根目录文件夹（理论上不应该出现，因为路径都以 / 开头）
						newPath = "/" + newName + "/"
					}
				} else {
					newPath = "/" + newName + "/"
				}

				// 更新文件夹自身
				const updatedFolder: AttachmentItem = {
					...item,
					name: newName,
					path: newName,
					relative_file_path: newPath,
				}

				// 如果有子项，递归更新子项的路径
				if (item.children) {
					updatedFolder.children = updateChildrenPaths(item.children, oldPath, newPath)
				}

				return updatedFolder
			} else {
				// 文件：只更新文件自身的路径
				const oldPath = item.relative_file_path || ""
				let newPath = oldPath

				// 计算新的 relative_file_path
				// 文件格式："/A/B.txt" 或 "/B.txt"
				if (oldPath) {
					const lastSlashIndex = oldPath.lastIndexOf("/")
					if (lastSlashIndex >= 0) {
						// 获取父路径（包括斜杠）并加上新文件名
						newPath = oldPath.substring(0, lastSlashIndex + 1) + newName
					} else {
						// 没有斜杠的情况（理论上不应该出现）
						newPath = "/" + newName
					}
				} else {
					newPath = "/" + newName
				}

				return {
					...item,
					file_name: newName,
					filename: newName,
					display_filename: newName,
					relative_file_path: newPath,
				}
			}
		}

		// 如果是文件夹，递归处理children
		if (item.is_directory && "children" in item) {
			return {
				...item,
				children: updateItemNameInAttachments(item.children || [], targetId, newName),
			}
		}

		return item
	})
}

/**
 * useRename - 处理文件/文件夹重命名功能
 */
export function useRename(options: UseRenameOptions = {}) {
	const {
		onRenameSuccess,
		onRenameError,
		onUpdateAttachments,
		attachments,
		onAttachmentsChange,
	} = options
	const { t } = useTranslation("super")
	// 重命名相关状态
	const [renamingItemId, setRenamingItemId] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState("")
	const [renamingFileIds, setRenamingFileIds] = useState<Set<string>>(new Set())
	const [renameErrorMessage, setRenameErrorMessage] = useState<string>("")
	const renameInputRef = useRef<InputRef>(null)

	// 获取文件或文件夹的唯一标识符
	const getItemId = (item: AttachmentItem): string => {
		// 旧文件夹数据时，不存在file_id，自己构造一个id
		if (item.is_directory && "children" in item && !item.file_id) {
			// 文件夹使用路径作为唯一标识
			return item.relative_file_path || `${item.name}`
		} else {
			// 文件使用file_id
			return item.file_id || ""
		}
	}

	// 聚焦并选择文件名的统一处理函数
	const focusAndSelectFileName = (inputRef: InputRef) => {
		inputRef.focus()

		// 获取文件名和扩展名
		const fullName = renameValue
		const lastDotIndex = fullName.lastIndexOf(".")

		if (lastDotIndex > 0 && lastDotIndex < fullName.length - 1) {
			// 选中文件名部分（不包括扩展名）
			inputRef.setSelectionRange(0, lastDotIndex)
		} else {
			// 如果没有扩展名，选中整个文件名
			inputRef.setSelectionRange(0, fullName.length)
		}
	}

	// 清除错误消息当输入值变化时
	useEffect(() => {
		if (renameErrorMessage) {
			setRenameErrorMessage("")
		}
	}, [renameValue])

	// 处理错误信息变化时的聚焦
	useUpdateEffect(() => {
		if (renameErrorMessage && renamingItemId && renameInputRef.current) {
			// 当有错误信息时，聚焦输入框
			const focusTimer = setTimeout(() => {
				if (renameInputRef.current) {
					focusAndSelectFileName(renameInputRef.current)
				}
			}, 100)

			return () => clearTimeout(focusTimer)
		}
	}, [renameErrorMessage])

	// 重命名功能 - 处理输入框聚焦时全选文件名（不包括扩展名）
	useEffect(() => {
		if (renamingItemId && renameInputRef.current) {
			setTimeout(() => {
				if (renameInputRef.current) {
					focusAndSelectFileName(renameInputRef.current)
				}
			}, 0)
		}
	}, [renamingItemId])

	// 开始重命名
	const handleStartRename = (item: AttachmentItem) => {
		const itemId = getItemId(item)
		const currentName = item.is_directory
			? item.name || ""
			: item.file_name || item.filename || ""
		setRenamingItemId(itemId)
		setRenameValue(currentName)
		setRenameErrorMessage("")
	}

	// 查找项目的工具函数
	const findItemById = (items: AttachmentItem[], targetId: string): AttachmentItem | null => {
		for (const item of items) {
			const itemId = getItemId(item)
			if (itemId === targetId) {
				return item
			}
			if (item.is_directory && "children" in item && item.children) {
				const found = findItemById(item.children, targetId)
				if (found) return found
			}
		}
		return null
	}

	// 确认重命名
	const handleRenameConfirm = async () => {
		if (!renamingItemId || !renameValue.trim()) {
			handleRenameCancel()
			return
		}

		const trimmedName = renameValue.trim()

		// 查找当前重命名的项目
		const currentItem = findItemById(attachments || [], renamingItemId)
		if (!currentItem) {
			handleRenameCancel()
			return
		}

		// 获取原始名称
		const originalName = currentItem.is_directory
			? currentItem.name || ""
			: currentItem.file_name || currentItem.filename || ""

		// 如果名称没有变化，直接取消重命名
		if (trimmedName === originalName) {
			handleRenameCancel()
			return
		}

		// 解析 itemId 获取文件ID
		const fileId = renamingItemId.startsWith("folder:") ? null : renamingItemId
		const isFolder = !fileId

		// 文件名/文件夹名校验
		const validationResult = validateFilename(trimmedName, isFolder, { t })
		if (!validationResult.isValid) {
			setRenameErrorMessage("")
			setTimeout(() => {
				setRenameErrorMessage(validationResult.errorMessage || "名称格式不正确")
			}, 0)
			return
		}

		// 获取父路径
		const parentPath = currentItem?.relative_file_path
			? currentItem.relative_file_path.substring(
				0,
				currentItem.relative_file_path.lastIndexOf("/"),
			)
			: undefined

		// 检查是否重复
		if (
			checkDuplicateFileName(
				trimmedName,
				attachments || [],
				parentPath,
				renamingItemId,
				getItemId,
			)
		) {
			setRenameErrorMessage("")
			setTimeout(() => {
				setRenameErrorMessage(t("topicFiles.contextMenu.newFile.duplicateError"))
			}, 0)
			return
		}

		// 如果是文件夹且没有 fileId，暂时不支持重命名
		if (!fileId) {
			setRenamingItemId(null)
			setRenameValue("")
			return
		}

		// 防止重复重命名
		if (renamingFileIds.has(fileId)) {
			return
		}

		try {
			// 添加到重命名中状态
			setRenamingFileIds((prev) => new Set(prev).add(fileId))

			// 调用重命名API
			await SuperMagicApi.renameFile({
				file_id: fileId,
				target_name: trimmedName,
			})

			// 如果有onAttachmentsChange回调，使用本地更新
			if (onAttachmentsChange && attachments) {
				const updatedAttachments = updateItemNameInAttachments(
					attachments,
					fileId,
					trimmedName,
				)
				onAttachmentsChange(updatedAttachments)
			} else {
				// 回退到原有的pubsub方式
				pubsub.publish(PubSubEvents.Update_Attachments)
				onUpdateAttachments?.()
			}

			// 调用成功回调
			if (onRenameSuccess) {
				onRenameSuccess(renamingItemId, trimmedName)
			}

			magicToast.success(t("topicFiles.contextMenu.renameSuccess"))

			// 重置状态
			setRenamingItemId(null)
			setRenameValue("")
			setRenameErrorMessage("")
		} catch (error: any) {
			console.error("重命名失败:", error)
			setRenameErrorMessage(error?.message || t("topicFiles.contextMenu.renameFailed"))

			// 调用错误回调
			if (onRenameError) {
				onRenameError(error)
			}
		} finally {
			// 移除重命名中状态
			setRenamingFileIds((prev) => {
				const newSet = new Set(prev)
				newSet.delete(fileId)
				return newSet
			})
		}
	}

	// 取消重命名
	const handleRenameCancel = () => {
		setRenamingItemId(null)
		setRenameValue("")
		setRenameErrorMessage("")
	}

	// 键盘事件处理
	const handleRenameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleRenameConfirm()
		} else if (e.key === "Escape") {
			handleRenameCancel()
		}
	}

	// 检查文件是否正在重命名中
	const isFileRenaming = (item: AttachmentItem) => {
		const fileId = getItemId(item)
		return renamingFileIds.has(fileId)
	}

	// 重置重命名状态
	const resetRename = () => {
		setRenamingItemId(null)
		setRenameValue("")
		setRenameErrorMessage("")
		setRenamingFileIds(new Set())
	}

	return {
		// 状态
		renamingItemId,
		renameValue,
		setRenameValue,
		renameInputRef,
		renamingFileIds,
		renameErrorMessage,

		// 处理函数
		handleStartRename,
		handleRenameConfirm,
		handleRenameCancel,
		handleRenameKeyDown,
		getItemId,
		isFileRenaming,
		resetRename,
	}
}
