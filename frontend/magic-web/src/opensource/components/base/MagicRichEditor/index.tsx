/* eslint-disable no-console */
import type { Content, Editor, UseEditorOptions, EditorEvents } from "@tiptap/react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import FontSize from "tiptap-extension-font-size"
import type { HTMLAttributes } from "react"
import {
	forwardRef,
	memo,
	useImperativeHandle,
	useMemo,
	useRef,
	useCallback,
	useEffect,
	useState,
} from "react"
import { useTranslation } from "react-i18next"
import { omit } from "lodash-es"
import { nodePasteRule, Extension } from "@tiptap/core"
import HardBlock from "@tiptap/extension-hard-break"
import type { EditorView } from "@tiptap/pm/view"
import type { Slice } from "@tiptap/pm/model"
import { history, undo, redo } from "@tiptap/pm/history"
import { Image } from "./extensions/image"
import ToolBar from "./components/ToolBar"
import useStyles from "./styles"
import MagicEmojiNodeExtension from "./extensions/magicEmoji"
import { fileToBase64 } from "./utils"
import { FileHandler } from "./extensions/file-handler"
import type { FileError } from "./utils"
import Placeholder from "./components/Placeholder"
import { message } from "antd"

// 自定义历史管理扩展，确保正确处理撤销/重做
const CustomHistory = Extension.create({
	name: "customHistory",

	addProseMirrorPlugins() {
		return [
			history({
				// 增加历史记录深度
				depth: 100,
				// 增加新事务组的延迟，确保更连贯的历史记录
				// 从300ms增加到500ms，让连续操作更容易被合并为一个历史记录
				newGroupDelay: 500,
			}),
		]
	},

	// 添加撤销/重做的快捷键映射
	addKeyboardShortcuts() {
		return {
			// 撤销 - Ctrl+Z/Cmd+Z
			"Mod-z": ({ editor }) => {
				if (editor.can().undo()) {
					// 使用增强的撤销命令
					editor.commands.first(({ commands }) => [
						// 首先尝试正常撤销
						() => commands.undo(),
						// 检查撤销后的状态
						() => {
							// 获取当前文档状态
							const { isEmpty } = editor
							const content = editor.getJSON()

							// 如果撤销后编辑器是空的或只有一个内容项，可能是一个中间状态
							if (isEmpty || (content.content && content.content.length <= 1)) {
								// 再次尝试撤销（如果可以）来跳过中间状态
								setTimeout(() => {
									if (editor.can().undo()) {
										commands.undo()
									}
								}, 0)
							}
							return true
						},
					])
					return true
				}
				return false
			},
			// 重做 - Ctrl+Y/Cmd+Shift+Z
			"Mod-y": ({ editor }) => {
				if (editor.can().redo()) {
					// 使用增强的重做命令
					editor.commands.first(({ commands }) => [
						// 首先尝试正常重做
						() => commands.redo(),
						// 检查重做后的状态
						() => {
							// 获取当前文档状态
							const { isEmpty } = editor
							const content = editor.getJSON()

							// 如果重做后编辑器是空的或只有一个内容项，可能是一个中间状态
							if (isEmpty || (content.content && content.content.length <= 1)) {
								// 再次尝试重做（如果可以）来跳过中间状态
								setTimeout(() => {
									if (editor.can().redo()) {
										commands.redo()
									}
								}, 0)
							}
							return true
						},
					])
					return true
				}
				return false
			},
			// 重做 - Ctrl+Shift+Z/Cmd+Shift+Z (macOS风格)
			"Mod-Shift-z": ({ editor }) => {
				if (editor.can().redo()) {
					// 使用增强的重做命令
					editor.commands.first(({ commands }) => [
						// 首先尝试正常重做
						() => commands.redo(),
						// 检查重做后的状态
						() => {
							// 获取当前文档状态
							const { isEmpty } = editor
							const content = editor.getJSON()

							// 如果重做后编辑器是空的或只有一个内容项，可能是一个中间状态
							if (isEmpty || (content.content && content.content.length <= 1)) {
								// 再次尝试重做（如果可以）来跳过中间状态
								setTimeout(() => {
									if (editor.can().redo()) {
										commands.redo()
									}
								}, 0)
							}
							return true
						},
					])
					return true
				}
				return false
			},
		}
	},

	// 添加撤销和重做命令
	addCommands() {
		return {
			undo:
				() =>
				({ state, dispatch }) => {
					// 使用顶层导入的undo命令
					return undo(state, dispatch)
				},
			redo:
				() =>
				({ state, dispatch }) => {
					// 使用顶层导入的redo命令
					return redo(state, dispatch)
				},
		}
	},

	// 处理文本输入事务，确保正确添加到历史堆栈
	addOptions() {
		return {
			newGroupDelay: 500, // 增加延迟以匹配上面的配置
		}
	},
})

const HardBlockExtension = HardBlock.extend({
	addPasteRules() {
		return [
			nodePasteRule({
				find: /\n/g,
				type: this.type,
			}),
		]
	},
})

interface MagicRichEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	/** 是否显示工具栏 */
	showToolBar?: boolean
	/** 占位符 */
	placeholder?: string
	/** 内容 */
	content?: Content
	/** 编辑器配置 */
	editorProps?: UseEditorOptions
	/** 回车键回调 */
	onEnter?: (editor: Editor) => void
	/** 粘贴失败回调 */
	onPasteFileFail?: (error: FileError[]) => void
	/** 是否移除回车键默认行为 */
	enterBreak?: boolean
	contentProps?: HTMLAttributes<HTMLDivElement>
}

export interface MagicRichEditorRef {
	editor: Editor | null
}

const MagicRichEditor = memo(
	forwardRef<MagicRichEditorRef, MagicRichEditorProps>((props, ref) => {
		const {
			content,
			placeholder,
			showToolBar = true,
			editorProps,
			enterBreak = false,
			contentProps,
			onPasteFileFail,
			...otherProps
		} = props
		const { styles } = useStyles()
		const { t } = useTranslation("interface")

		const parentDom = useRef<HTMLDivElement>(null)

		// 创建一个 editorRef 来解决循环引用问题
		const editorRef = useRef<Editor | null>(null)

		// 用于处理自定义占位符
		const [showPlaceholder, setShowPlaceholder] = useState(!content)

		// 错误状态管理
		const [error, setError] = useState<string | null>(null)

		// 使用 useCallback 优化 onPaste 回调函数
		const handlePaste = useCallback(async (editor: Editor, files: File[]) => {
			try {
				console.log("FileHandler onPaste", files)
				// 确保只处理一次
				if (!files.length) return

				const currentPos = editor.state.selection.$from.pos
				// 只处理第一个文件，避免重复插入
				const file = files[0]
				const src = await fileToBase64(file)
				editor.commands.insertContent({
					type: Image.name,
					attrs: { src, file_name: file.name, file_size: file.size },
				})

				editor.commands.focus(currentPos + 1)
			} catch (err) {
				console.error("Error handling paste:", err)
				setError("图片粘贴失败，请重试")
			}
		}, [])

		// 使用 useCallback 优化 onImageRemoved 回调函数
		const handleImageRemoved = useCallback((attrs: Record<string, any>) => {
			console.log("Image removed", attrs)
			// 如果是 blob URL，需要释放
			if (attrs.src?.startsWith("blob:")) {
				try {
					URL.revokeObjectURL(attrs.src)
				} catch (err) {
					console.error("Error revoking blob URL:", err)
				}
			}
		}, [])

		const extensions = useMemo(() => {
			const list = [
				// 自定义历史管理，取代StarterKit内置的history
				CustomHistory,
				// 在测试环境中跳过extend方法的调用
				process.env.NODE_ENV === "test"
					? StarterKit.configure({
							blockquote: false,
							codeBlock: false,
							hardBreak: false,
							// 禁用StarterKit内置的history，使用我们的自定义history
							history: false,
					  })
					: StarterKit.configure({
							blockquote: false,
							codeBlock: false,
							hardBreak: false,
							// 禁用StarterKit内置的history，使用我们的自定义history
							history: false,
					  }).extend({
							addKeyboardShortcuts() {
								return {
									// 移除回车键默认行为
									Enter: () => enterBreak,
								}
							},
					  }),
				FontSize,
				Highlight,
				TextAlign,
				TextStyle,
				Image.configure({
					inline: true,
					allowedMimeTypes: ["image/*"],
					maxFileSize: 15 * 1024 * 1024,
					onImageRemoved: handleImageRemoved,
					onValidationError: onPasteFileFail,
				}),
				FileHandler.configure({
					allowedMimeTypes: ["image/*"],
					maxFileSize: 15 * 1024 * 1024,
					onPaste: handlePaste,
					onValidationError: onPasteFileFail,
				}),
				// MentionExtension.configure({
				// 	HTMLAttributes: {
				// 		class: styles.mention,
				// 	},
				// 	suggestion: suggestion(getParentDom),
				// 	deleteTriggerWithBackspace: true,
				// }),
				MagicEmojiNodeExtension.configure({
					HTMLAttributes: {
						className: styles.emoji,
					},
					basePath: "/emojis",
				}),
				HardBlockExtension,
			]
			return list
		}, [enterBreak, handleImageRemoved, handlePaste, onPasteFileFail, styles.emoji])

		const pasteSize = useRef<{
			originalPosition: number
			size: number
		} | null>(null)

		// 使用 useCallback 优化 handlePasteText 函数
		const handlePasteText = useCallback((view: EditorView, event: ClipboardEvent) => {
			// 如果有文件，让 FileHandler 处理，直接返回 false 不做任何处理
			if (event.clipboardData?.files.length) {
				return false
			}

			// 获取纯文本内容
			const text = event.clipboardData?.getData("text/plain")

			if (text) {
				// 阻止默认粘贴行为
				event.preventDefault()

				// 创建一个段落序列，每个换行符作为一个新段落
				const parts = text.split("\n")
				const transaction = view.state.tr
				const { selection } = view.state

				// 如果有选中内容，先删除
				if (!selection.empty) {
					transaction.delete(selection.from, selection.to)
					// 注意：我们不在这里设置setMeta("addToHistory", true)，
					// 这样删除操作就会作为当前事务的一部分，而不是单独的历史记录
				}

				let pos = selection.from

				// 将这些段落逐个插入到文档中
				for (let i = 0; i < parts.length; i += 1) {
					// 插入文本部分
					if (parts[i].length > 0) {
						transaction.insertText(parts[i], pos)
						pos += parts[i].length
					}

					// 在每个部分之后（除最后一个）插入硬换行
					if (i < parts.length - 1) {
						const hardBreakNode = view.state.schema.nodes.hardBreak.create()
						transaction.insert(pos, hardBreakNode)
						pos += 1
					}
				}

				// 确保粘贴操作被添加到历史记录中
				transaction.setMeta("addToHistory", true)

				// 应用事务
				view.dispatch(transaction)

				return true
			}

			return false
		}, [])

		// 使用 useCallback 优化 handleEditorUpdate 函数
		const handleEditorUpdate = useCallback(
			(updateProps: EditorEvents["update"]) => {
				const { editor: e } = updateProps
				if (pasteSize.current) {
					e.commands.focus(pasteSize.current.originalPosition + pasteSize.current.size)
					pasteSize.current = null
				}

				// 更新占位符状态
				setShowPlaceholder(e.isEmpty)

				editorProps?.onUpdate?.(updateProps)
			},
			[editorProps],
		)

		// 使用 useCallback 优化 onPaste 函数
		const handleOnPaste = useCallback((_: ClipboardEvent, slice: Slice) => {
			// 只在处理纯文本粘贴时记录位置
			if (!slice.content.firstChild?.type.name.includes("image")) {
				pasteSize.current = {
					originalPosition: editorRef.current?.state.selection.$from.pos ?? 0,
					size: slice.content.size,
				}
			}
		}, [])

		// 使用 Memo 优化编辑器配置
		const editorConfig = useMemo(
			() => ({
				onPaste: handleOnPaste,
				editorProps: {
					handlePaste: handlePasteText,
				},
				enablePasteRules: true,
				extensions: [...extensions, ...(editorProps?.extensions ?? [])],
				content,
				autofocus: true,
				immediatelyRender: true,
				shouldRerenderOnTransaction: true,
				onUpdate: handleEditorUpdate,
				...omit(editorProps, ["extensions", "onUpdate"]),
			}),
			[content, editorProps, extensions, handleEditorUpdate, handleOnPaste, handlePasteText],
		)

		const editor = useEditor(editorConfig)

		// 更新 editorRef
		useEffect(() => {
			editorRef.current = editor
			// 初始化后更新占位符状态
			if (editor) {
				setShowPlaceholder(editor.isEmpty)
			}
		}, [editor])

		useImperativeHandle(ref, () => ({
			editor,
		}))

		// 清除错误
		useEffect(() => {
			if (error) {
				const timer = setTimeout(() => {
					setError(null)
				}, 3000)
				return () => clearTimeout(timer)
			}
			return undefined
		}, [error])

		// 组件卸载时清理资源
		useEffect(() => {
			return () => {
				// 销毁编辑器
				if (editorRef.current) {
					editorRef.current.destroy()
				}
			}
		}, [])

		// 添加全局样式覆盖，确保没有外边框
		useEffect(() => {
			// 添加全局样式
			const styleElement = document.createElement("style")
			styleElement.textContent = `
				.ProseMirror, .ProseMirror:focus, .ProseMirror:focus-visible,
				div[contenteditable="true"], div[contenteditable="true"]:focus, div[contenteditable="true"]:focus-visible {
					outline: none !important;
					box-shadow: none !important;
					border: none !important;
				}
				
				/* 修复高度问题 */
				.ProseMirror {
					height: auto !important;
					min-height: inherit !important;
					overflow: hidden !important;
					max-height: none !important;
					caret-color: inherit !important; /* 使用继承的光标颜色 */
				}
				
				/* 确保段落没有多余的边距 */
				.ProseMirror p {
					margin: 0 !important;
					padding: 0 !important;
					line-height: 1.5em !important; /* 设置固定行高 */
					min-height: 1em !important;
					max-height: none !important;
					position: relative !important;
				}
				
				/* 光标样式，确保不会影响布局 */
				.ProseMirror .ProseMirror-cursor {
					margin: 0 !important;
					padding: 0 !important;
					position: absolute !important;
					z-index: 1 !important;
				}
				
				/* 修复编辑器容器高度 */
				.tiptap {
					height: auto !important;
					min-height: inherit !important;
					overflow: hidden !important;
					display: flex !important;
					flex-direction: column !important;
				}
				
				/* 添加focus状态下占位符样式 */
				.ProseMirror:focus p.is-editor-empty:first-child::before,
				.ProseMirror:focus p.is-empty::before {
					color: #d9d9d9;
					top: 0 !important;
					left: 0 !important;
					transform: translateY(0) !important;
					line-height: 1.5em !important;
				}

				p[data-suggestion] {
					position: relative;
					overflow: visible;
				}

				/* 恢复自动补全提醒样式 */
				p[data-suggestion]::after {
					color: #bfbfbf;
					content: attr(data-suggestion);
					pointer-events: none;
					height: 0;
				}
			`
			document.head.appendChild(styleElement)

			// 清理函数
			return () => {
				document.head.removeChild(styleElement)
			}
		}, [])

		return (
			<div ref={parentDom} {...otherProps} id="magic-rich-editor">
				{showToolBar && <ToolBar className={styles.toolbar} editor={editor} />}
				<div style={{ position: "relative" }}>
					<Placeholder
						placeholder={placeholder ?? t("richEditor.placeholder")}
						show={showPlaceholder}
					/>
					<EditorContent
						className={styles.content}
						editor={editor}
						style={{
							height: "auto",
							overflow: "hidden",
							display: "flex",
							flexDirection: "column",
						}}
						{...contentProps}
					/>
				</div>
				{error && <div className={styles.error}>{error}</div>}
			</div>
		)
	}),
)

export default MagicRichEditor
