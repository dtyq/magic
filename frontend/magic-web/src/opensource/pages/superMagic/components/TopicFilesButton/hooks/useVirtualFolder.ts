import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { useDebounceFn, useUpdateEffect } from "ahooks"
import type { InputRef } from "antd"
import type { AttachmentItem } from "./types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { validateFilename } from "@/opensource/utils/filename-validator"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"

interface VirtualFolderItem {
	id: string
	name: string
	parentPath?: string
	isVirtual: true
	is_directory: true
}

interface UseVirtualFolderOptions {
	attachments: AttachmentItem[]
	setExpandedKeys: (expandedKeys: React.Key[]) => void
	expandedKeys: React.Key[]
	// 修改：文件夹创建回调，允许返回创建结果
	onFolderCreate?: (folderName: string, parentPath?: string) => Promise<any>
	// 添加直接更新attachments的回调
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
}

// 工具函数：将新文件夹添加到attachments的正确位置
const addFolderToAttachments = (
	attachments: AttachmentItem[],
	newFolder: AttachmentItem,
	parentPath?: string,
): AttachmentItem[] => {
	if (!parentPath) {
		// 在根目录：新建文件夹放在第一个位置
		return [newFolder, ...attachments]
	}

	// 递归查找父文件夹并添加
	const addToFolder = (items: AttachmentItem[]): AttachmentItem[] => {
		return items.map((item) => {
			if (item.is_directory && "children" in item) {
				const folderPath = item.relative_file_path || `/${item.name}`
				if (folderPath === parentPath) {
					// 在此文件夹中添加新文件夹到第一个位置
					return {
						...item,
						children: [newFolder, ...(item.children || [])],
					}
				}
				return {
					...item,
					children: addToFolder(item.children || []),
				}
			}
			return item
		})
	}

	return addToFolder(attachments)
}

/**
 * useVirtualFolder - 处理虚拟文件夹创建功能
 */
export function useVirtualFolder(options: UseVirtualFolderOptions) {
	const { t } = useTranslation("super")
	const { attachments, setExpandedKeys, expandedKeys } = options
	const [virtualFolder, setVirtualFolder] = useState<VirtualFolderItem | null>(null)
	const [editingVirtualId, setEditingVirtualId] = useState<string | null>(null)
	const [virtualFolderName, setVirtualFolderName] = useState("")
	const [errorMessage, setErrorMessage] = useState("")
	const virtualInputRef = useRef<InputRef>(null)
	const hasFocusedRef = useRef(false)

	// 聚焦并选择文件夹名的统一处理函数
	const focusAndSelectFolderName = (inputRef: InputRef) => {
		inputRef.focus()
		// 选中整个文件夹名
		inputRef.setSelectionRange(0, virtualFolderName.length)
		hasFocusedRef.current = true
	}

	// 处理虚拟文件夹输入框聚焦
	useEffect(() => {
		if (editingVirtualId && !hasFocusedRef.current) {
			// 延时确保 Tree 展开动画完成后再聚焦
			const focusTimer = setTimeout(() => {
				if (virtualInputRef.current) {
					const input = virtualInputRef.current

					// 检查元素是否可见
					const inputElement = input.input
					const isVisible = inputElement && inputElement.offsetParent !== null
					if (!isVisible) {
						// 如果元素不可见，再次延时重试
						setTimeout(() => {
							if (virtualInputRef.current) {
								focusAndSelectFolderName(virtualInputRef.current)
							}
						}, 200)
						return
					}

					focusAndSelectFolderName(input)
				}
			}, 100) // 给 Tree 展开一些时间

			return () => clearTimeout(focusTimer)
		} else if (!editingVirtualId) {
			// 当 editingVirtualId 变为 null 时，重置聚焦状态
			hasFocusedRef.current = false
		}
	}, [editingVirtualId, virtualFolderName.length])

	// 处理错误信息变化时的聚焦
	useUpdateEffect(() => {
		if (errorMessage && editingVirtualId && virtualInputRef.current) {
			// 当有错误信息时，聚焦输入框
			const focusTimer = setTimeout(() => {
				if (virtualInputRef.current) {
					focusAndSelectFolderName(virtualInputRef.current)
				}
			}, 100)

			return () => clearTimeout(focusTimer)
		}
	}, [errorMessage])

	// 创建虚拟文件夹
	const createVirtualFolder = (key?: string, parentPath?: string) => {
		// 如果已经有虚拟文件夹在编辑中，不允许创建新的虚拟文件夹
		if (editingVirtualId || virtualFolder) {
			return
		}

		// 如果在文件夹内创建文件夹，自动展开该文件夹
		if (key && setExpandedKeys) {
			setExpandedKeys([...expandedKeys, key])
		}

		const defaultName = t("topicFiles.contextMenu.newFolder.defaultName")

		const newVirtualFolder: VirtualFolderItem = {
			id: `virtual_folder_${Date.now()}`,
			name: defaultName,
			isVirtual: true,
			is_directory: true,
			parentPath,
		}

		// 设置单个虚拟文件夹
		setVirtualFolder(newVirtualFolder)
		setEditingVirtualId(newVirtualFolder.id)
		setVirtualFolderName(defaultName)
		setErrorMessage("")
	}

	// 清理虚拟文件夹状态的统一方法
	const clearVirtualFolder = () => {
		setVirtualFolder(null)
		setEditingVirtualId(null)
		setVirtualFolderName("")
		setErrorMessage("")
	}

	// 确认虚拟文件夹创建
	const confirmVirtualFolder = async () => {
		if (!editingVirtualId || !virtualFolder) return

		const trimmedName = virtualFolderName.trim()

		// 检查名称是否为空
		if (!trimmedName) {
			cancelVirtualFolder()
			return
		}

		// 文件夹名称校验
		const validationResult = validateFilename(trimmedName, true, { t })
		if (!validationResult.isValid) {
			setErrorMessage("")
			setTimeout(() => {
				setErrorMessage(validationResult.errorMessage || "文件夹名称格式不正确")
			}, 0)
			return
		}

		// 检查是否重复
		if (checkDuplicateFileName(trimmedName, attachments, virtualFolder.parentPath)) {
			setErrorMessage("")
			setTimeout(() => {
				setErrorMessage(t("topicFiles.contextMenu.newFolder.duplicateError"))
			}, 0)
			return
		}

		try {
			console.log("创建文件夹:", {
				name: trimmedName,
				parentPath: virtualFolder.parentPath,
			})

			// 调用文件夹创建回调
			const result = await options.onFolderCreate?.(trimmedName, virtualFolder.parentPath)

			// 显示成功提示
			magicToast.success(t("topicFiles.contextMenu.createFolderSuccess"))

			// 如果有onAttachmentsChange回调，使用本地更新
			if (options.onAttachmentsChange && result) {
				// 构建真实文件夹数据
				const realFolder: AttachmentItem = {
					file_id: result.file_id || result.id,
					name: trimmedName,
					path: trimmedName,
					type: "folder",
					is_directory: true,
					children: [],
				}

				// 将新文件夹添加到attachments的正确位置
				const updatedAttachments = addFolderToAttachments(
					attachments,
					realFolder,
					virtualFolder.parentPath,
				)

				// 更新本地状态
				options.onAttachmentsChange(updatedAttachments)
			} else {
				// 回退到原有的pubsub方式
				pubsub.publish(PubSubEvents.Update_Attachments)
			}

			// 创建成功后清理虚拟文件夹
			clearVirtualFolder()
		} catch (error) {
			console.error("创建文件夹失败:", error)
			setErrorMessage("创建文件夹失败，请重试")
			// 失败时不清理虚拟文件夹，让用户可以看到错误并重新尝试
		}
	}

	// 防抖的确认虚拟文件夹创建函数
	const { run: debouncedConfirmVirtualFolder } = useDebounceFn(confirmVirtualFolder, {
		wait: 300,
	})

	// 取消虚拟文件夹创建
	const cancelVirtualFolder = () => {
		clearVirtualFolder()
	}

	// 处理键盘事件
	const handleVirtualFolderKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			debouncedConfirmVirtualFolder()
		} else if (e.key === "Escape") {
			e.preventDefault()
			cancelVirtualFolder()
		}
	}

	// 获取虚拟文件夹列表
	const virtualFolders = virtualFolder ? [virtualFolder] : []

	// 合并虚拟文件夹到附件列表
	const mergeVirtualFolders = (attachmentList: AttachmentItem[]) => {
		if (!virtualFolder) return attachmentList

		const { parentPath } = virtualFolder

		// 将虚拟文件夹转换为AttachmentItem格式
		const virtualAttachment: AttachmentItem = {
			file_id: virtualFolder.id, // 添加file_id以确保key的稳定性
			name: virtualFolder.name,
			path: virtualFolder.name,
			type: "folder",
			is_directory: true,
			children: [],
			isVirtual: true,
		} as AttachmentItem & { isVirtual: boolean }

		if (!parentPath) {
			// 添加到根目录的第一个位置
			return [virtualAttachment, ...attachmentList]
		}

		// 递归插入到指定文件夹
		const insertIntoFolder = (items: AttachmentItem[]): AttachmentItem[] => {
			return items.map((item) => {
				if (item.is_directory && "children" in item) {
					const folderPath = item.relative_file_path || `/${item.name}`
					if (folderPath === parentPath) {
						return {
							...item,
							children: [virtualAttachment, ...(item.children || [])],
						}
					}
					return {
						...item,
						children: insertIntoFolder(item.children || []),
					}
				}
				return item
			})
		}

		return insertIntoFolder(attachmentList)
	}

	// 重置虚拟文件夹状态
	const resetVirtualFolder = () => {
		setVirtualFolder(null)
		setEditingVirtualId(null)
		setVirtualFolderName("")
		setErrorMessage("")
	}

	return {
		// 状态
		virtualFolders,
		editingVirtualId,
		virtualFolderName,
		setVirtualFolderName,
		errorMessage,

		// Refs
		virtualInputRef,

		// 处理函数
		createVirtualFolder,
		confirmVirtualFolder,
		cancelVirtualFolder,
		handleVirtualFolderKeyDown,
		mergeVirtualFolders,
		resetVirtualFolder,
	}
}
