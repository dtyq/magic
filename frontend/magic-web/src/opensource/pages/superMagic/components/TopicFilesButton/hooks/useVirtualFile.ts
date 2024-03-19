import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { useDebounceFn, useUpdateEffect } from "ahooks"
import type { InputRef } from "antd"
import { AttachmentSource, type AttachmentItem } from "./types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { validateFilename } from "@/opensource/utils/filename-validator"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"

// 文件类型映射
const FILE_TYPE_MAP = {
	txt: "txt",
	md: "md",
	html: "html",
	py: "py",
	go: "go",
	php: "php",
	design: "design",
	custom: "",
}

// 文件内容模板
const FILE_TEMPLATES = {
	txt: " ",
	md: "# 新建文档\n\n在这里开始编写您的 Markdown 内容...\n",
	html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新建页面</title>
</head>
<body>
    <h1>欢迎使用</h1>
    <p>在这里开始编写您的 HTML 内容...</p>
</body>
</html>`,
	py: `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新建 Python 文件
"""

def main():
    """主函数"""
    print("Hello, World!")

if __name__ == "__main__":
    main()
`,
	go: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
`,
	php: `<?php
/**
 * 新建 PHP 文件
 */

echo "Hello, World!";
?>
`,
	design: "{}",
	custom: " ",
}

// 获取 MIME 类型
const getMimeType = (extension: string): string => {
	const mimeTypes: Record<string, string> = {
		txt: "text/plain",
		md: "text/markdown",
		html: "text/html",
		py: "text/x-python",
		go: "text/x-go",
		php: "application/x-httpd-php",
		design: "application/json",
	}
	return mimeTypes[extension] || "text/plain"
}

interface VirtualFileItem {
	id: string
	name: string
	type: keyof typeof FILE_TYPE_MAP
	parentPath?: string
	isVirtual: true
}

interface UseVirtualFileOptions {
	attachments: AttachmentItem[]
	setExpandedKeys: (expandedKeys: React.Key[]) => void
	// 修改：文件上传回调，允许返回创建结果
	onFileCreate?: (file: File, suffixDir?: string) => Promise<any>
	expandedKeys: React.Key[]
	// 添加直接更新attachments的回调
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
}

// 工具函数：将新文件添加到attachments的正确位置（文件夹后，文件前）
const addFileToAttachments = (
	attachments: AttachmentItem[],
	newFile: AttachmentItem,
	parentPath?: string,
): AttachmentItem[] => {
	if (!parentPath) {
		// 在根目录：新建文件放在所有文件夹后、所有文件前
		const folders = attachments.filter((item) => item.is_directory)
		const files = attachments.filter((item) => !item.is_directory)
		return [...folders, newFile, ...files]
	}

	// 递归查找父文件夹并添加
	const addToFolder = (items: AttachmentItem[]): AttachmentItem[] => {
		return items.map((item) => {
			if (item.is_directory && "children" in item) {
				const folderPath = item.relative_file_path || `/${item.name}`
				if (folderPath === parentPath) {
					// 在此文件夹中按排序规则添加新文件
					const currentChildren = item.children || []
					const childFolders = currentChildren.filter((child) => child.is_directory)
					const childFiles = currentChildren.filter((child) => !child.is_directory)
					return {
						...item,
						children: [...childFolders, newFile, ...childFiles],
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
 * useVirtualFile - 处理虚拟文件创建功能
 */
export function useVirtualFile(options: UseVirtualFileOptions) {
	const { t } = useTranslation("super")
	const { attachments, setExpandedKeys, expandedKeys } = options
	const [virtualFile, setVirtualFile] = useState<VirtualFileItem | null>(null)
	const [editingVirtualId, setEditingVirtualId] = useState<string | null>(null)
	const [virtualFileName, setVirtualFileName] = useState("")
	const [errorMessage, setErrorMessage] = useState("")
	const virtualInputRef = useRef<InputRef>(null)
	const hasFocusedRef = useRef(false)

	// 聚焦并选择文件名的统一处理函数
	const focusAndSelectFileName = (inputRef: InputRef) => {
		inputRef.focus()

		// 获取文件名和扩展名
		const fullName = virtualFileName
		const lastDotIndex = fullName.lastIndexOf(".")

		if (lastDotIndex > 0 && lastDotIndex < fullName.length - 1) {
			// 选中文件名部分（不包括扩展名）
			inputRef.setSelectionRange(0, lastDotIndex)
		} else {
			// 如果没有扩展名，选中整个文件名
			inputRef.setSelectionRange(0, fullName.length)
		}
		hasFocusedRef.current = true
	}

	// 处理虚拟文件输入框聚焦
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
								focusAndSelectFileName(virtualInputRef.current)
							}
						}, 200)
						return
					}

					focusAndSelectFileName(input)
				}
			}, 100) // 给 Tree 展开一些时间

			return () => clearTimeout(focusTimer)
		} else if (!editingVirtualId) {
			// 当 editingVirtualId 变为 null 时，重置聚焦状态
			hasFocusedRef.current = false
		}
	}, [editingVirtualId, virtualFileName])

	// 处理错误信息变化时的聚焦
	useUpdateEffect(() => {
		if (errorMessage && editingVirtualId && virtualInputRef.current) {
			// 当有错误信息时，聚焦输入框
			const focusTimer = setTimeout(() => {
				if (virtualInputRef.current) {
					focusAndSelectFileName(virtualInputRef.current)
				}
			}, 100)

			return () => clearTimeout(focusTimer)
		}
	}, [errorMessage])

	// 创建虚拟文件
	const createVirtualFile = (
		type: keyof typeof FILE_TYPE_MAP,
		key?: string,
		parentPath?: string,
	) => {
		// 如果已经有虚拟文件在编辑中，不允许创建新的虚拟文件
		if (editingVirtualId || virtualFile) {
			return
		}

		// 如果在文件夹内创建文件，自动展开该文件夹
		if (key && setExpandedKeys) {
			setExpandedKeys([...expandedKeys, key])
		}

		const fileExtension = FILE_TYPE_MAP[type]
		const defaultName = t("topicFiles.contextMenu.newFile.defaultName")
		const fullName = fileExtension ? `${defaultName}.${fileExtension}` : defaultName

		const newVirtualFile: VirtualFileItem = {
			id: `virtual_${Date.now()}`,
			name: fullName,
			type,
			isVirtual: true,
			parentPath,
		}

		// 设置单个虚拟文件
		setVirtualFile(newVirtualFile)
		setEditingVirtualId(newVirtualFile.id)
		setVirtualFileName(fullName)
		setErrorMessage("")
	}

	// 确认虚拟文件创建
	const confirmVirtualFile = async () => {
		if (!editingVirtualId || !virtualFile) return

		const trimmedName = virtualFileName.trim()

		// 检查名称是否为空
		if (!trimmedName) {
			cancelVirtualFile()
			return
		}

		// 文件名校验
		const validationResult = validateFilename(trimmedName, false, { t })
		if (!validationResult.isValid) {
			setErrorMessage("")
			setTimeout(() => {
				setErrorMessage(validationResult.errorMessage || "文件名格式不正确")
			}, 0)
			return
		}

		// 检查是否重复
		if (checkDuplicateFileName(trimmedName, attachments, virtualFile.parentPath)) {
			setErrorMessage("")
			setTimeout(() => {
				setErrorMessage(t("topicFiles.contextMenu.newFile.duplicateError"))
			}, 0)
			return
		}

		try {
			// 获取文件内容模板
			const extension = FILE_TYPE_MAP[virtualFile.type]
			const content = FILE_TEMPLATES[virtualFile.type]

			// 创建 File 对象
			const file = new File([content], trimmedName, {
				type: getMimeType(extension),
				lastModified: Date.now(),
			})

			// 计算上传目录
			const targetSuffixDir = virtualFile.parentPath
				? virtualFile.parentPath.substring(1)
				: ""

			console.log("创建虚拟文件:", {
				name: trimmedName,
				parentPath: virtualFile.parentPath,
				type: virtualFile.type,
				extension,
				targetSuffixDir,
				contentLength: content.length,
			})

			// 调用文件上传回调
			if (options.onFileCreate) {
				const result = await options.onFileCreate(file, targetSuffixDir)

				// 显示成功提示
				magicToast.success(t("topicFiles.contextMenu.createFileSuccess"))

				// 如果有onAttachmentsChange回调，使用本地更新
				if (options.onAttachmentsChange && result) {
					// 构建真实文件数据
					const realFile: AttachmentItem = {
						file_id: result.file_id || result.id,
						file_name: trimmedName,
						filename: trimmedName,
						file_extension: extension,
						is_directory: false,
						source: AttachmentSource.PROJECT_DIRECTORY,
					}

					// 将新文件添加到attachments的正确位置
					const updatedAttachments = addFileToAttachments(
						attachments,
						realFile,
						virtualFile.parentPath,
					)

					// 更新本地状态
					options.onAttachmentsChange(updatedAttachments)
				} else {
					// 回退到原有的pubsub方式
					pubsub.publish(PubSubEvents.Update_Attachments)
				}

				// 创建成功后清理虚拟文件
				clearVirtualFile()
			}
		} catch (error) {
			console.error("创建文件失败:", error)
			setErrorMessage("创建文件失败，请重试")
			// 失败时不清理虚拟文件，让用户可以看到错误并重新尝试
		}
	}

	// 防抖的确认虚拟文件创建函数
	const { run: debouncedConfirmVirtualFile } = useDebounceFn(confirmVirtualFile, {
		wait: 300,
	})

	// 清理虚拟文件状态的统一方法
	const clearVirtualFile = () => {
		setVirtualFile(null)
		setEditingVirtualId(null)
		setVirtualFileName("")
		setErrorMessage("")
	}

	// 取消虚拟文件创建
	const cancelVirtualFile = () => {
		clearVirtualFile()
	}

	// 处理键盘事件
	const handleVirtualFileKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			debouncedConfirmVirtualFile()
		} else if (e.key === "Escape") {
			e.preventDefault()
			cancelVirtualFile()
		}
	}

	// 获取虚拟文件列表
	const virtualFiles = virtualFile ? [virtualFile] : []

	// 合并虚拟文件到附件列表
	const mergeVirtualFiles = (attachmentList: AttachmentItem[]) => {
		if (!virtualFile) {
			return attachmentList
		}

		const { parentPath } = virtualFile

		// 将虚拟文件转换为AttachmentItem格式
		const virtualAttachment: AttachmentItem = {
			file_id: virtualFile.id,
			file_name: virtualFile.name,
			file_extension: FILE_TYPE_MAP[virtualFile.type],
			is_directory: false,
			isVirtual: true,
		} as AttachmentItem & { isVirtual: boolean }

		if (!parentPath) {
			// 在根目录：将文件夹和文件分离，虚拟文件放在所有文件夹之后、现有文件之前
			const folders = attachmentList.filter((item) => item.is_directory)
			const files = attachmentList.filter((item) => !item.is_directory)
			return [...folders, virtualAttachment, ...files]
		}

		// 递归插入到指定文件夹
		const insertIntoFolder = (items: AttachmentItem[]): AttachmentItem[] => {
			return items.map((item) => {
				if (item.is_directory && "children" in item) {
					const folderPath = item.relative_file_path || `/${item.name}`
					if (folderPath === parentPath) {
						const currentChildren = item.children || []
						// 将子项分离为文件夹和文件，虚拟文件放在所有文件夹之后、现有文件之前
						const childFolders = currentChildren.filter((child) => child.is_directory)
						const childFiles = currentChildren.filter((child) => !child.is_directory)
						return {
							...item,
							children: [...childFolders, virtualAttachment, ...childFiles],
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

	// 重置虚拟文件状态
	const resetVirtualFile = () => {
		setVirtualFile(null)
		setEditingVirtualId(null)
		setVirtualFileName("")
		setErrorMessage("")
	}

	return {
		// 状态
		virtualFiles,
		editingVirtualId,
		virtualFileName,
		setVirtualFileName,
		errorMessage,

		// Refs
		virtualInputRef,

		// 处理函数
		createVirtualFile,
		confirmVirtualFile,
		cancelVirtualFile,
		handleVirtualFileKeyDown,
		mergeVirtualFiles,
		resetVirtualFile,
	}
}
