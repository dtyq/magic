import type { Content, Editor, UseEditorOptions, EditorEvents } from "@tiptap/react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle, FontSize } from "@tiptap/extension-text-style"
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
import ToolBar from "./components/ToolBar"
import useStyles from "./styles"
import MagicEmojiNodeExtension from "./extensions/magicEmoji"
import type { FileError } from "./utils"
import Placeholder from "./components/Placeholder"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useImageExtensions } from "./hooks/useImageExtensions"

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
	/** 是否自动聚焦 */
	autofocus?: boolean
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
	/** 打字机效果的打字速度（毫秒/字符） */
	typingSpeed?: number
	/** 是否启用打字机效果 */
	enableTypingEffect?: boolean
}

export interface MagicRichEditorRef {
	editor: Editor | null
}

const MagicRichEditor = memo(
	forwardRef<MagicRichEditorRef, MagicRichEditorProps>((props, ref) => {
		const {
			content,
			autofocus = true,
			placeholder,
			showToolBar = true,
			editorProps,
			enterBreak = false,
			contentProps,
			onPasteFileFail,
			typingSpeed = 80,
			enableTypingEffect = true,
			...otherProps
		} = props
		const isMobile = useIsMobile()
		const { styles } = useStyles({ isMobile })
		const { t } = useTranslation("interface")

		const parentDom = useRef<HTMLDivElement>(null)

		// 创建一个 editorRef 来解决循环引用问题
		const editorRef = useRef<Editor | null>(null)

		// 用于处理自定义占位符
		const [showPlaceholder, setShowPlaceholder] = useState(!content)

		// 使用图片扩展插件 hook
		const {
			extensions: imageExtensions,
			error: imageError,
			clearError,
		} = useImageExtensions({
			onPasteFileFail,
		})

		const extensions = useMemo(() => {
			const list = [
				// 自定义历史管理，取代StarterKit内置的history
				CustomHistory,
				// 在测试环境中跳过extend方法的调用
				StarterKit.configure({
					blockquote: false,
					codeBlock: false,
					orderedList: false,
					bulletList: false,
					code: false,
					hardBreak: false,
					// 禁用StarterKit内置的undoRedo，使用我们的自定义history
					undoRedo: false,
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
				// 图片和文件处理插件
				...imageExtensions,
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
		}, [enterBreak, imageExtensions, styles.emoji])

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

			// 如果有HTML且包含带file_id的图片，让 FileHandler 处理
			const html = event.clipboardData?.getData("text/html")
			if (html && html.includes("file_id=")) {
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
		const editorConfig = useMemo<UseEditorOptions>(
			() => ({
				onPaste: handleOnPaste,
				editorProps: {
					handlePaste: handlePasteText,
				},
				enablePasteRules: true,
				extensions: [...extensions, ...(editorProps?.extensions ?? [])],
				content,
				autofocus,
				immediatelyRender: true,
				shouldRerenderOnTransaction: true,
				onUpdate: handleEditorUpdate,
				...omit(editorProps, ["extensions", "onUpdate"]),
			}),
			[
				autofocus,
				content,
				editorProps,
				extensions,
				handleEditorUpdate,
				handleOnPaste,
				handlePasteText,
			],
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
			if (imageError) {
				const timer = setTimeout(() => {
					clearError()
				}, 3000)
				return () => clearTimeout(timer)
			}
			return undefined
		}, [imageError, clearError])

		// 组件卸载时清理资源
		useEffect(() => {
			return () => {
				// 销毁编辑器
				if (editorRef.current) {
					editorRef.current.destroy()
				}
			}
		}, [])

		return (
			<div ref={parentDom} {...otherProps} id="magic-rich-editor">
				{showToolBar && <ToolBar className={styles.toolbar} editor={editor} />}
				<div style={{ position: "relative" }}>
					<Placeholder
						placeholder={placeholder ?? t("richEditor.placeholder")}
						show={showPlaceholder}
						typingSpeed={typingSpeed}
						enableTypingEffect={enableTypingEffect}
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
				{imageError && <div className={styles.error}>{imageError}</div>}
			</div>
		)
	}),
)

export default MagicRichEditor
