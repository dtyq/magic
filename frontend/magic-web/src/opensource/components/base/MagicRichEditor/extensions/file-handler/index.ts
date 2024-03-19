import { type Editor, Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { FileError, FileValidationOptions } from "../../utils"
import { filterFiles } from "../../utils"
import { getMessageIdFromHTML, parseImagesFromHTML, processHtmlWithImages } from "./htmlImageParser"

type FileHandlePluginOptions = {
	key?: PluginKey
	editor: Editor
	onPaste?: (editor: Editor, files: File[], pasteContent?: string) => void
	onDrop?: (editor: Editor, files: File[], pos: number) => void
	onValidationError?: (errors: FileError[]) => void
} & FileValidationOptions

const FileHandlePlugin = (options: FileHandlePluginOptions) => {
	const { key, editor, onPaste, onDrop, onValidationError, allowedMimeTypes, maxFileSize } =
		options

	return new Plugin({
		key: key || new PluginKey("fileHandler"),

		props: {
			handleDrop(view, event) {
				event.preventDefault()
				event.stopPropagation()

				const { dataTransfer } = event

				if (!dataTransfer?.files.length) {
					return false
				}

				const pos = view.posAtCoords({
					left: event.clientX,
					top: event.clientY,
				})

				const [validFiles, errors] = filterFiles(Array.from(dataTransfer.files), {
					allowedMimeTypes,
					maxFileSize,
					allowBase64: options.allowBase64,
				})

				if (errors.length > 0 && onValidationError) {
					onValidationError(errors)
				}

				if (validFiles.length > 0 && onDrop) {
					onDrop(editor, validFiles, pos?.pos ?? 0)
				}

				return true
			},
			handlePaste(_, event) {
				const { clipboardData } = event
				const files = clipboardData?.files
				const html = clipboardData?.getData("text/html")

				// Check if there are files to upload
				if (files?.length) {
					// 阻止默认粘贴行为
					event.preventDefault()
					event.stopPropagation()

					const [validFiles, errors] = filterFiles(Array.from(files), {
						allowedMimeTypes,
						maxFileSize,
						allowBase64: options.allowBase64,
					})

					if (errors.length > 0 && onValidationError) {
						onValidationError(errors)
					}

					if (validFiles.length > 0 && onPaste) {
						onPaste(editor, validFiles, html)
					}

					return true
				}

				// If no files but has HTML, check for images with file_id
				if (html) {
					console.log("📋 Paste HTML detected:", html)
					const parsedImages = parseImagesFromHTML(html)
					console.log("🖼️ Parsed images:", parsedImages)

					if (parsedImages.length > 0) {
						const messageId = getMessageIdFromHTML(html)
						console.log("💬 Message ID:", messageId)

						if (!messageId) {
							console.warn("Could not extract message ID from HTML")
							return false
						}

						// 阻止默认粘贴行为，我们手动处理
						event.preventDefault()
						event.stopPropagation()

						// 处理混合内容：保持文本和图片的相对位置
						processHtmlWithImages(html, parsedImages, messageId, editor, onPaste)

						return true
					}
				}

				return false
			},
		},
	})
}

export const FileHandler = Extension.create<Omit<FileHandlePluginOptions, "key" | "editor">>({
	name: "fileHandler",

	addOptions() {
		return {
			allowBase64: false,
			allowedMimeTypes: [],
			maxFileSize: 0,
		}
	},

	addProseMirrorPlugins() {
		return [
			FileHandlePlugin({
				key: new PluginKey(this.name),
				editor: this.editor,
				...this.options,
			}),
		]
	},
})
