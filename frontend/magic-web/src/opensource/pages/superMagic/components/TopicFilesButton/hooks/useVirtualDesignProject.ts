import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn, useUpdateEffect } from "ahooks"
import type { InputRef } from "antd"
import type { AttachmentItem } from "./types"
import { AttachmentSource } from "./types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { validateFilename } from "@/opensource/utils/filename-validator"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"

interface VirtualDesignProjectItem {
	id: string
	name: string
	parentPath?: string
	isVirtual: true
	is_directory: true
}

interface UseVirtualDesignProjectOptions {
	attachments: AttachmentItem[]
	setExpandedKeys: (expandedKeys: React.Key[]) => void
	expandedKeys: React.Key[]
	// 画布项目创建回调，允许返回创建结果
	onDesignProjectCreate?: (
		folderName: string,
		parentPath?: string,
	) => Promise<{ file_id?: string; id?: string } | undefined>
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
 * useVirtualDesignProject - 处理虚拟画布项目创建功能
 */
export function useVirtualDesignProject(options: UseVirtualDesignProjectOptions) {
	const { t } = useTranslation("super")
	const { attachments, setExpandedKeys, expandedKeys } = options
	const [virtualDesignProject, setVirtualDesignProject] =
		useState<VirtualDesignProjectItem | null>(null)
	const [editingVirtualId, setEditingVirtualId] = useState<string | null>(null)
	const [virtualDesignProjectName, setVirtualDesignProjectName] = useState("")
	const [errorMessage, setErrorMessage] = useState("")
	const virtualInputRef = useRef<InputRef>(null)
	const hasFocusedRef = useRef(false)

	// 聚焦并选择文件夹名的统一处理函数
	const focusAndSelectFolderName = (inputRef: InputRef) => {
		inputRef.focus()
		// 选中整个文件夹名
		inputRef.setSelectionRange(0, virtualDesignProjectName.length)
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editingVirtualId, virtualDesignProjectName.length])

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

	// 创建虚拟画布项目
	const createVirtualDesignProject = (key?: string, parentPath?: string) => {
		// 如果已经有虚拟文件夹在编辑中，不允许创建新的虚拟文件夹
		if (editingVirtualId || virtualDesignProject) {
			return
		}

		// 如果在文件夹内创建文件夹，自动展开该文件夹
		if (key && setExpandedKeys) {
			setExpandedKeys([...expandedKeys, key])
		}

		const defaultName = t("topicFiles.contextMenu.newDesign.defaultName")

		const newVirtualDesignProject: VirtualDesignProjectItem = {
			id: `virtual_design_project_${Date.now()}`,
			name: defaultName,
			isVirtual: true,
			is_directory: true,
			parentPath,
		}

		// 设置单个虚拟文件夹
		setVirtualDesignProject(newVirtualDesignProject)
		setEditingVirtualId(newVirtualDesignProject.id)
		setVirtualDesignProjectName(defaultName)
		setErrorMessage("")
	}

	// 清理虚拟文件夹状态的统一方法
	const clearVirtualDesignProject = () => {
		setVirtualDesignProject(null)
		setEditingVirtualId(null)
		setVirtualDesignProjectName("")
		setErrorMessage("")
	}

	// 确认虚拟画布项目创建
	const confirmVirtualDesignProject = async () => {
		if (!editingVirtualId || !virtualDesignProject) return

		const trimmedName = virtualDesignProjectName.trim()

		// 检查名称是否为空
		if (!trimmedName) {
			cancelVirtualDesignProject()
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
		if (checkDuplicateFileName(trimmedName, attachments, virtualDesignProject.parentPath)) {
			setErrorMessage("")
			setTimeout(() => {
				setErrorMessage(t("topicFiles.contextMenu.newFolder.duplicateError"))
			}, 0)
			return
		}

		try {
			// 调用画布项目创建回调
			const result = await options.onDesignProjectCreate?.(
				trimmedName,
				virtualDesignProject.parentPath,
			)

			// 显示成功提示（createDesignProject 内部已经显示成功消息，这里不需要重复显示）

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
					source: AttachmentSource.PROJECT_DIRECTORY,
				}

				// 将新文件夹添加到attachments的正确位置
				const updatedAttachments = addFolderToAttachments(
					attachments,
					realFolder,
					virtualDesignProject.parentPath,
				)

				// 更新本地状态
				options.onAttachmentsChange(updatedAttachments)
			} else {
				// 回退到原有的pubsub方式
				pubsub.publish(PubSubEvents.Update_Attachments)
			}

			// 创建成功后清理虚拟文件夹
			clearVirtualDesignProject()
		} catch (error) {
			setErrorMessage("创建画布项目失败，请重试")
			// 失败时不清理虚拟文件夹，让用户可以看到错误并重新尝试
		}
	}

	// 防抖的确认虚拟画布项目创建函数
	const { run: debouncedConfirmVirtualDesignProject } = useDebounceFn(
		confirmVirtualDesignProject,
		{
			wait: 300,
		},
	)

	// 取消虚拟画布项目创建
	const cancelVirtualDesignProject = () => {
		clearVirtualDesignProject()
	}

	// 处理键盘事件
	const handleVirtualDesignProjectKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			debouncedConfirmVirtualDesignProject()
		} else if (e.key === "Escape") {
			e.preventDefault()
			cancelVirtualDesignProject()
		}
	}

	// 获取虚拟文件夹列表
	const virtualDesignProjects = virtualDesignProject ? [virtualDesignProject] : []

	// 合并虚拟文件夹到附件列表
	const mergeVirtualDesignProjects = (attachmentList: AttachmentItem[]) => {
		if (!virtualDesignProject) return attachmentList

		const { parentPath } = virtualDesignProject

		// 将虚拟文件夹转换为AttachmentItem格式
		const virtualAttachment: AttachmentItem & { isVirtual: boolean } = {
			file_id: virtualDesignProject.id, // 添加file_id以确保key的稳定性
			name: virtualDesignProject.name,
			path: virtualDesignProject.name,
			type: "folder",
			is_directory: true,
			children: [],
			source: AttachmentSource.PROJECT_DIRECTORY,
			isVirtual: true,
		}

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
	const resetVirtualDesignProject = () => {
		setVirtualDesignProject(null)
		setEditingVirtualId(null)
		setVirtualDesignProjectName("")
		setErrorMessage("")
	}

	return {
		// 状态
		virtualDesignProjects,
		editingVirtualId,
		virtualDesignProjectName,
		setVirtualDesignProjectName,
		errorMessage,

		// Refs
		virtualInputRef,

		// 处理函数
		createVirtualDesignProject,
		confirmVirtualDesignProject,
		cancelVirtualDesignProject,
		handleVirtualDesignProjectKeyDown,
		mergeVirtualDesignProjects,
		resetVirtualDesignProject,
	}
}
