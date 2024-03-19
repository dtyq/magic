import { useCallback, useMemo, useState } from "react"
import type { Editor } from "@tiptap/react"
import { Image } from "../extensions/image"
import { FileHandler } from "../extensions/file-handler"
import { fileToBase64 } from "../utils"
import type { FileError } from "../utils"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

export interface UseImageExtensionsOptions {
	/** 允许的 MIME 类型 */
	allowedMimeTypes?: string[]
	/** 最大文件大小（字节） */
	maxFileSize?: number
	/** 粘贴失败回调 */
	onPasteFileFail?: (error: FileError[]) => void
	/** 图片移除回调 */
	onImageRemoved?: (attrs: Record<string, any>) => void
	/** 粘贴处理回调 */
	onPaste?: (editor: Editor, files: File[]) => Promise<void>
}

const defaultAllowedMimeTypes = ["image/*"]

export function useImageExtensions(options: UseImageExtensionsOptions = {}) {
	const {
		allowedMimeTypes = defaultAllowedMimeTypes,
		maxFileSize = 15 * 1024 * 1024, // 15MB
		onPasteFileFail,
		onImageRemoved: customOnImageRemoved,
		onPaste: customOnPaste,
	} = options

	const isMobile = useIsMobile()
	const [error, setError] = useState<string | null>(null)

	// Default image removal handler
	const handleImageRemoved = useCallback(
		(attrs: Record<string, any>) => {
			console.log("Image removed", attrs)
			// 如果是 blob URL，需要释放
			if (attrs.src?.startsWith("blob:")) {
				try {
					URL.revokeObjectURL(attrs.src)
				} catch (err) {
					console.error("Error revoking blob URL:", err)
				}
			}
			// 调用自定义回调
			customOnImageRemoved?.(attrs)
		},
		[customOnImageRemoved],
	)

	// Default paste handler
	const handlePaste = useCallback(
		async (editor: Editor, files: File[]) => {
			// 如果有自定义处理函数，优先使用
			if (customOnPaste) {
				await customOnPaste(editor, files)
				return
			}

			// 移动端不支持粘贴图片
			if (isMobile) return

			try {
				console.log("FileHandler onPaste", files)
				// 确保只处理一次
				if (!files.length) return

				const currentPos = editor.state.selection.$from.pos
				// 只处理第一个文件，避免重复插入
				const file = files[0]
				const src = await fileToBase64(file)
				console.log("file", file)

				const [fileName, fileExt] = file.name.split(".")
				const file_name = fileExt
					? `${fileName}_${Date.now()}.${fileExt}`
					: `${fileName}_${Date.now()}`

				editor.commands.insertContent({
					type: Image.name,
					attrs: { src, file_name, file_size: file.size },
				})

				editor.commands.focus(currentPos + 1)
			} catch (err) {
				console.error("Error handling paste:", err)
				setError("图片粘贴失败，请重试")
			}
		},
		[isMobile, customOnPaste],
	)

	// 清除错误
	const clearError = useCallback(() => {
		setError(null)
	}, [])

	// 返回配置好的插件数组
	const extensions = useMemo(
		() => [
			Image.configure({
				inline: true,
				allowedMimeTypes,
				maxFileSize,
				onImageRemoved: handleImageRemoved,
				onValidationError: onPasteFileFail,
			}),
			FileHandler.configure({
				allowedMimeTypes,
				maxFileSize,
				onPaste: handlePaste,
				onValidationError: onPasteFileFail,
			}),
		],
		[allowedMimeTypes, handleImageRemoved, handlePaste, maxFileSize, onPasteFileFail],
	)

	return {
		extensions,
		error,
		clearError,
		handleImageRemoved,
		handlePaste,
	}
}
