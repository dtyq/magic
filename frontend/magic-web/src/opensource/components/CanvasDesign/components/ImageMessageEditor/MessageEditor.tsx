import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, useMemo } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Extension } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import HardBreak from "@tiptap/extension-hard-break"
import Placeholder from "@tiptap/extension-placeholder"
import { UndoRedo } from "@tiptap/extensions"
import { useMount } from "ahooks"
import type { MentionDataServicePort } from "./MessageEditor.types"
import {
	getStringFromContent,
	getContentFromString,
	getMentionPathsFromContent,
	getMatchablePathsFromValue,
	type MatchableMentionItem,
} from "./tiptap/contentUtils"
import styles from "./index.module.css"
import tiptapStyles from "./tiptap-editor.module.css"

interface MessageEditorProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	onEnter?: () => void
	autoFocus?: boolean
	onScrollbarChange?: (hasScrollbar: boolean) => void
	/** 可匹配的 @ 项，用于 string 转 JSON */
	matchableItems?: MatchableMentionItem[]
	/** @ 面板数据服务（兼容 MentionPanel DataService） */
	mentionDataService?: MentionDataServicePort
	/** Mention 扩展实例（通过依赖注入传入，实现组件隔离） */
	mentionExtension?: Extension | null
	language?: string
	/** @ 提及路径列表变化时的回调（去重后的路径列表，currentPrompt 为编辑器当前内容） */
	onMentionChange?: (paths: string[], currentPrompt: string) => void
	/** 是否启用 @ 功能（模型列表加载完成后才为 true） */
	mentionEnabled?: boolean
}

export interface MessageEditorRef {
	focus: () => void
	/** 获取编辑器当前的内容（字符串形式） */
	getCurrentPrompt: () => string
}

const MessageEditor = forwardRef<MessageEditorRef, MessageEditorProps>(
	function MessageEditor(props, ref) {
		const {
			value,
			onChange,
			placeholder,
			onEnter,
			autoFocus = false,
			onScrollbarChange,
			matchableItems = [],
			mentionExtension: injectedMentionExtension,
			onMentionChange,
			mentionEnabled = true,
		} = props
		const editorContainerRef = useRef<HTMLDivElement>(null)
		const isInternalChangeRef = useRef(false)
		const prevMatchableItemsRef = useRef<MatchableMentionItem[]>([])

		const checkScrollbar = useCallback(() => {
			if (!editorContainerRef.current || !onScrollbarChange) return
			const wrapper = editorContainerRef.current
			const hasScrollbar = wrapper.scrollHeight > wrapper.clientHeight
			onScrollbarChange(hasScrollbar)
			return hasScrollbar
		}, [onScrollbarChange])

		const scrollToBottom = useCallback(() => {
			if (!editorContainerRef.current) return
			const wrapper = editorContainerRef.current
			if (wrapper.scrollHeight > wrapper.clientHeight) {
				wrapper.scrollTop = wrapper.scrollHeight
			}
		}, [])

		// 使用外部注入的 mentionExtension，如果没有注入则返回 null（不启用 @ 功能）
		const mentionExtension = injectedMentionExtension

		const extensions = useMemo(() => {
			const base = [
				Document,
				Paragraph,
				Text,
				HardBreak,
				Placeholder.configure({ placeholder: placeholder ?? "" }),
				UndoRedo.configure({
					depth: 100,
					newGroupDelay: 250,
				}),
			]
			if (mentionExtension) {
				base.push(mentionExtension)
			}
			return base
		}, [placeholder, mentionExtension])

		const editor = useEditor({
			extensions,
			content: getContentFromString(value, matchableItems),
			editorProps: {
				handleKeyDown: (_, event) => {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault()
						onEnter?.()
						return true
					}
					if (event.key === "Enter" && event.shiftKey) {
						requestAnimationFrame(() => {
							requestAnimationFrame(() => {
								scrollToBottom()
							})
						})
					}
					return false
				},
			},
			onUpdate: ({ editor: e }) => {
				if (isInternalChangeRef.current) return
				const str = getStringFromContent(e.getJSON())
				onChange(str)
				if (onMentionChange) {
					const paths = getMentionPathsFromContent(e.getJSON())
					onMentionChange(paths, str)
				}
			},
		})

		useImperativeHandle(ref, () => ({
			focus: () => editor?.commands.focus(),
			getCurrentPrompt: () => {
				if (!editor) return ""
				return getStringFromContent(editor.getJSON())
			},
		}))

		// value 变化时 setContent；matchableItems 延迟到达时（挂载后 syncFromElement 完成）需重新解析以恢复 @mention 样式
		useEffect(() => {
			if (!editor) return
			const currentStr = getStringFromContent(editor.getJSON())
			const pathsInEditor = new Set(getMentionPathsFromContent(editor.getJSON()))
			const matchablePathsInValue = getMatchablePathsFromValue(value, matchableItems)
			const hasMentionsRenderedAsText = matchablePathsInValue.some(
				(p) => !pathsInEditor.has(p),
			)
			prevMatchableItemsRef.current = matchableItems

			if (currentStr !== value) {
				const contentToSet = getContentFromString(value, matchableItems)
				isInternalChangeRef.current = true
				editor.commands.setContent(contentToSet, {
					emitUpdate: false,
				})
				queueMicrotask(() => {
					isInternalChangeRef.current = false
				})
			} else if (hasMentionsRenderedAsText) {
				// value 中有 @ 能匹配 matchableItems，但编辑器当前以 text 渲染，需重新解析
				const contentToSet = getContentFromString(value, matchableItems)
				isInternalChangeRef.current = true
				editor.commands.setContent(contentToSet, {
					emitUpdate: false,
				})
				queueMicrotask(() => {
					isInternalChangeRef.current = false
				})
			}
		}, [value, matchableItems, editor])

		useMount(() => {
			if (autoFocus && editor) {
				setTimeout(() => editor.commands.focus(), 50)
			}
			checkScrollbar()
		})

		useEffect(() => {
			const timer = setTimeout(checkScrollbar, 0)
			return () => clearTimeout(timer)
		}, [value, checkScrollbar])

		useEffect(() => {
			if (!editor || !mentionExtension) return
			// @ts-ignore
			editor.commands.updateMentionEnabled?.(mentionEnabled)
		}, [editor, mentionExtension, mentionEnabled])

		if (!editor) return null

		return (
			<div ref={editorContainerRef} className={styles.editorWrapper}>
				<EditorContent editor={editor} className={tiptapStyles.tiptapEditor} />
			</div>
		)
	},
)

export default MessageEditor
