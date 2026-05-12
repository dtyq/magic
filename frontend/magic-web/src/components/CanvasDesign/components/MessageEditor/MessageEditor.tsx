import {
	forwardRef,
	useImperativeHandle,
	useRef,
	useEffect,
	useCallback,
	useMemo,
	type ClipboardEvent,
} from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Extension, Node as TiptapNode } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import HardBreak from "@tiptap/extension-hard-break"
import Placeholder from "@tiptap/extension-placeholder"
import { UndoRedo } from "@tiptap/extensions"
import { Fragment } from "@tiptap/pm/model"
import type { MentionDataServicePort, ReferenceResourcePanelItem } from "../../types"
import { useOverflowChange } from "../../hooks/useOverflowChange"
import {
	getStringFromContent,
	getContentFromString,
	getMentionPathsFromContent,
	getMatchablePathsFromValue,
	MENTION_CARET_GUARD_TEXT,
	type MatchableMentionItem,
} from "./tiptap/contentUtils"
import styles from "./index.module.css"
import tiptapStyles from "./tiptap-editor.module.css"

interface MentionEditorCommands {
	updateMentionEnabled?: (enabled: boolean) => boolean
	openMentionPanel?: () => boolean
}

interface MessageEditorProps {
	value?: string
	onChange?: (value: string) => void
	placeholder?: string
	onEnter?: () => void
	autoFocus?: boolean
	/** 跨卸载/重挂载恢复光标位置的持久化 key */
	selectionPersistenceKey?: string
	onScrollbarChange?: (hasScrollbar: boolean) => void
	/** 可匹配的 @ 项，用于 string 转 JSON */
	matchableItems?: MatchableMentionItem[]
	/** @ 面板数据服务（兼容 MentionPanel DataService） */
	mentionDataService?: MentionDataServicePort
	/** Mention 扩展实例（通过依赖注入传入，实现组件隔离；TipTap Mention 为 Node） */
	mentionExtension?: Extension | TiptapNode<unknown, unknown> | null
	language?: string
	/** @ 提及路径列表变化时的回调（去重后的路径列表，currentPrompt 为编辑器当前内容） */
	onMentionChange?: (paths: string[], currentPrompt: string) => void
	/** hover 在某个 @ 提及项上时回调对应 path，离开时回调 null */
	onMentionItemHoverChange?: (path: string | null) => void
	/** 是否启用 @ 功能（模型列表加载完成后才为 true） */
	mentionEnabled?: boolean
	/** 为 true 时外层与编辑区宽度 100% 铺满父级（用于视频生成等较宽面板） */
	fullWidth?: boolean
	onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void
}

/** insertMentionItems 的可选行为（如上传/模式切换需在文末追加 @，与 appendMentionToString 一致） */
export interface InsertCanvasMentionItemsOptions {
	placement?: "cursor" | "documentEnd"
}

interface MessageEditorSelectionRange {
	from: number
	to: number
}

const MAX_PERSISTED_SELECTION_RANGE_COUNT = 200
const persistedSelectionRangeMap = new Map<string, MessageEditorSelectionRange>()

export interface MessageEditorRef {
	focus: () => void
	/** 获取编辑器当前的内容（字符串形式） */
	getCurrentPrompt: () => string
	openMentionPanel: () => void
	insertMentionItem: (
		item: ReferenceResourcePanelItem,
		options?: InsertCanvasMentionItemsOptions,
	) => void
	insertMentionItems: (
		items: ReferenceResourcePanelItem[],
		options?: InsertCanvasMentionItemsOptions,
	) => void
}

const MessageEditor = forwardRef<MessageEditorRef, MessageEditorProps>(
	function MessageEditor(props, ref) {
		const {
			value,
			onChange,
			placeholder,
			onEnter,
			autoFocus = false,
			selectionPersistenceKey,
			onScrollbarChange,
			matchableItems = [],
			mentionExtension: injectedMentionExtension,
			onMentionChange,
			onMentionItemHoverChange,
			mentionEnabled = true,
			fullWidth = false,
			onPaste,
		} = props
		const editorContainerRef = useRef<HTMLDivElement>(null)
		const isInternalChangeRef = useRef(false)
		const latestFocusedSelectionRangeRef = useRef<MessageEditorSelectionRange | null>(null)
		const onEnterRef = useRef(onEnter)
		onEnterRef.current = onEnter
		// useEditor 仅依赖 mentionExtension；其余走 ref，避免整编辑器重建失焦
		const onChangeRef = useRef(onChange)
		onChangeRef.current = onChange
		const onMentionChangeRef = useRef(onMentionChange)
		onMentionChangeRef.current = onMentionChange
		const onMentionItemHoverChangeRef = useRef(onMentionItemHoverChange)
		onMentionItemHoverChangeRef.current = onMentionItemHoverChange
		const placeholderRef = useRef(placeholder ?? "")
		placeholderRef.current = placeholder ?? ""
		const hoveredMentionPathRef = useRef<string | null>(null)

		useEffect(() => {
			if (!selectionPersistenceKey) return
			latestFocusedSelectionRangeRef.current =
				getPersistedSelectionRange(selectionPersistenceKey)
		}, [selectionPersistenceKey])

		const getPreferredSelectionRange = useCallback(
			() =>
				resolvePreferredSelectionRange(
					latestFocusedSelectionRangeRef.current,
					selectionPersistenceKey,
				),
			[selectionPersistenceKey],
		)

		const resolveOverflowTargets = useCallback(
			(wrapper: HTMLDivElement) => [wrapper.firstElementChild],
			[],
		)
		const { checkOverflow: checkScrollbar } = useOverflowChange({
			targetRef: editorContainerRef,
			axis: "y",
			onOverflowChange: onScrollbarChange,
			observeTargets: resolveOverflowTargets,
		})

		const scrollToBottom = useCallback(() => {
			if (!editorContainerRef.current) return
			const wrapper = editorContainerRef.current
			if (wrapper.scrollHeight > wrapper.clientHeight) {
				wrapper.scrollTop = wrapper.scrollHeight
			}
		}, [])

		// 使用外部注入的 mentionExtension，如果没有注入则返回 null（不启用 @ 功能）
		const mentionExtension = injectedMentionExtension

		// extensions 不随 placeholder 变，防止 useEditor 销毁实例
		const extensions = useMemo(() => {
			const base = [
				Document,
				Paragraph,
				Text,
				HardBreak,
				Placeholder.configure({
					// 占位文案读 ref，勿把 placeholder 放进本 useMemo / useEditor 依赖
					placeholder: () => placeholderRef.current ?? "",
				}),
				UndoRedo.configure({
					depth: 100,
					newGroupDelay: 250,
				}),
			]
			if (mentionExtension) {
				base.push(mentionExtension)
			}
			return base
		}, [mentionExtension])

		const editor = useEditor(
			{
				extensions,
				content: getContentFromString(value ?? "", matchableItems),
				editorProps: {
					handleKeyDown: (_, event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							const handleEnter = onEnterRef.current
							if (!handleEnter) return false
							event.preventDefault()
							handleEnter()
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
					onChangeRef.current?.(str)
					const mentionCb = onMentionChangeRef.current
					if (mentionCb) {
						const paths = getMentionPathsFromContent(e.getJSON())
						mentionCb(paths, str)
					}
				},
				onSelectionUpdate: ({ editor: e }) => {
					if (!e.isFocused) return
					const selectionRange = {
						from: e.state.selection.from,
						to: e.state.selection.to,
					}
					latestFocusedSelectionRangeRef.current = selectionRange
					setPersistedSelectionRange(selectionPersistenceKey, selectionRange)
				},
			},
			// 此处依赖变化会整段销毁 TipTap，仅保留 mentionExtension
			[mentionExtension],
		)

		useImperativeHandle(ref, () => ({
			focus: () => {
				if (!editor || editor.isDestroyed) return
				focusEditorWithPreservedSelection(editor, getPreferredSelectionRange())
			},
			getCurrentPrompt: () => {
				if (!editor) return ""
				return getStringFromContent(editor.getJSON())
			},
			openMentionPanel: () => {
				if (!editor || !mentionExtension || !mentionEnabled) return
				;(editor.commands as MentionEditorCommands).openMentionPanel?.()
			},
			insertMentionItem: (
				item: ReferenceResourcePanelItem,
				options?: InsertCanvasMentionItemsOptions,
			) => {
				if (!editor) return
				insertMentionItemsToEditor(editor, [item], options, getPreferredSelectionRange)
			},
			insertMentionItems: (
				items: ReferenceResourcePanelItem[],
				options?: InsertCanvasMentionItemsOptions,
			) => {
				if (!editor) return
				insertMentionItemsToEditor(editor, items, options, getPreferredSelectionRange)
			},
		}))

		// value 变化时 setContent；matchableItems 延迟到达时（挂载后 syncFromElement 完成）需重新解析以恢复 @mention 样式。
		// 推迟到 microtask：TipTap 为 Mention 等 NodeView 创建 ReactRenderer 时会 flushSync，若在 React effect 栈内同步 setContent 会触发警告。
		useEffect(() => {
			if (!editor) return

			const valueSnapshot = value ?? ""
			const itemsSnapshot = matchableItems
			const syncMentionChange = () => {
				const mentionCb = onMentionChangeRef.current
				if (!mentionCb) return
				mentionCb(
					getMentionPathsFromContent(editor.getJSON()),
					getStringFromContent(editor.getJSON()),
				)
			}
			let cancelled = false

			queueMicrotask(() => {
				if (cancelled || !editor || editor.isDestroyed) return

				const currentStr = getStringFromContent(editor.getJSON())
				const pathsInEditor = new Set(getMentionPathsFromContent(editor.getJSON()))
				const matchablePathsInValue = getMatchablePathsFromValue(
					valueSnapshot,
					itemsSnapshot,
				)
				const hasMentionsRenderedAsText = matchablePathsInValue.some(
					(p) => !pathsInEditor.has(p),
				)

				if (currentStr !== valueSnapshot) {
					const contentToSet = getContentFromString(valueSnapshot, itemsSnapshot)
					isInternalChangeRef.current = true
					editor.commands.setContent(contentToSet, {
						emitUpdate: false,
					})
					syncMentionChange()
					queueMicrotask(() => {
						isInternalChangeRef.current = false
					})
					return
				}

				if (hasMentionsRenderedAsText) {
					const contentToSet = getContentFromString(valueSnapshot, itemsSnapshot)
					isInternalChangeRef.current = true
					editor.commands.setContent(contentToSet, {
						emitUpdate: false,
					})
					syncMentionChange()
					queueMicrotask(() => {
						isInternalChangeRef.current = false
					})
				}
			})

			return () => {
				cancelled = true
			}
		}, [value, matchableItems, editor])

		// 空文档时占位文案变更：空事务触发占位装饰重算（不重建 editor）
		useEffect(() => {
			placeholderRef.current = placeholder ?? ""
			if (!editor || editor.isDestroyed) return
			if (!editor.isEmpty) return
			queueMicrotask(() => {
				if (!editor || editor.isDestroyed) return
				editor.view.dispatch(editor.state.tr)
			})
		}, [placeholder, editor])

		useEffect(() => {
			checkScrollbar()
		}, [checkScrollbar])

		useEffect(() => {
			if (!autoFocus || !editor || editor.isDestroyed) return
			const timer = window.setTimeout(() => {
				if (!editor.isDestroyed) {
					focusEditorWithPreservedSelection(editor, getPreferredSelectionRange())
				}
			}, 50)
			return () => window.clearTimeout(timer)
		}, [autoFocus, editor, getPreferredSelectionRange])

		useEffect(() => {
			const timer = setTimeout(checkScrollbar, 0)
			return () => clearTimeout(timer)
		}, [value, checkScrollbar])

		useEffect(() => {
			if (!editor || !mentionExtension) return
			;(editor.commands as MentionEditorCommands).updateMentionEnabled?.(mentionEnabled)
		}, [editor, mentionExtension, mentionEnabled])

		useEffect(() => {
			if (!editor) return

			function getHoveredMentionPath(target: EventTarget | null): string | null {
				if (!(target instanceof Element)) return null
				const mentionEl = target.closest<HTMLElement>(".canvas-project-file-mention")
				return mentionEl?.dataset.filePath || null
			}

			function syncHoveredMentionPath(nextPath: string | null) {
				if (hoveredMentionPathRef.current === nextPath) return
				hoveredMentionPathRef.current = nextPath
				onMentionItemHoverChangeRef.current?.(nextPath)
			}

			function handlePointerOver(event: PointerEvent) {
				syncHoveredMentionPath(getHoveredMentionPath(event.target))
			}

			function handlePointerOut(event: PointerEvent) {
				const currentPath = getHoveredMentionPath(event.target)
				if (!currentPath) return
				const nextPath = getHoveredMentionPath(event.relatedTarget)
				if (nextPath === currentPath) return
				syncHoveredMentionPath(nextPath)
			}

			function handlePointerLeave() {
				syncHoveredMentionPath(null)
			}

			const editorDom = editor.view.dom
			editorDom.addEventListener("pointerover", handlePointerOver)
			editorDom.addEventListener("pointerout", handlePointerOut)
			editorDom.addEventListener("pointerleave", handlePointerLeave)

			return () => {
				editorDom.removeEventListener("pointerover", handlePointerOver)
				editorDom.removeEventListener("pointerout", handlePointerOut)
				editorDom.removeEventListener("pointerleave", handlePointerLeave)
				syncHoveredMentionPath(null)
			}
		}, [editor])

		if (!editor) return null

		const rootClassName = fullWidth
			? `${styles.editorContainer} ${styles.editorContainerFullWidth}`
			: styles.editorContainer

		return (
			<div
				className={rootClassName}
				onPaste={onPaste}
				data-testid="canvas-reference-editor-container"
			>
				<div ref={editorContainerRef} className={styles.editorWrapper}>
					<EditorContent editor={editor} className={tiptapStyles.tiptapEditor} />
				</div>
			</div>
		)
	},
)

function insertMentionItemsToEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	items: ReferenceResourcePanelItem[],
	options?: InsertCanvasMentionItemsOptions,
	getLatestFocusedSelectionRange?: () => MessageEditorSelectionRange | null,
) {
	if (items.length === 0) return

	const content = items.flatMap((item) => [
		{
			type: "mention",
			attrs: item,
		},
		{
			type: "text",
			text: MENTION_CARET_GUARD_TEXT,
		},
	])

	const fragment = Fragment.fromArray(content.map((node) => editor.schema.nodeFromJSON(node)))
	const fragSize = fragment.size
	const shouldUsePreservedSelection = options?.placement !== "documentEnd" && !editor.isFocused

	const chain = editor.chain()
	if (options?.placement === "documentEnd") {
		chain.focus("end")
	} else {
		chain.focus()
	}
	chain
		.command(({ tr, commands }) => {
			const currentSelection = tr.selection
			const preservedSelection = shouldUsePreservedSelection
				? getLatestFocusedSelectionRange?.()
				: null
			const maxPos = Math.max(1, tr.doc.content.size)
			const insertFrom = preservedSelection
				? Math.min(Math.max(preservedSelection.from, 1), maxPos)
				: currentSelection.from
			const insertTo = preservedSelection
				? Math.min(Math.max(preservedSelection.to, insertFrom), maxPos)
				: currentSelection.to
			if (
				!commands.insertContentAt({ from: insertFrom, to: insertTo }, content, {
					updateSelection: false,
				})
			) {
				return false
			}
			return commands.setTextSelection(insertFrom + fragSize)
		})
		.run()

	// 拖放等场景下焦点会留在 drop 容器上；延后一步把 DOM 焦点拉回编辑器，落在上面 setTextSelection 的选区（新内容之后）
	setTimeout(() => {
		if (editor.isDestroyed) return
		editor.commands.focus()
	}, 0)
}

export default MessageEditor

function focusEditorWithPreservedSelection(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	selectionRange: MessageEditorSelectionRange | null,
) {
	if (editor.isDestroyed) return

	if (!selectionRange) {
		editor.commands.focus("end")
		return
	}

	const maxPos = Math.max(1, editor.state.doc.content.size)
	const from = Math.min(Math.max(selectionRange.from, 1), maxPos)
	const to = Math.min(Math.max(selectionRange.to, from), maxPos)

	editor.chain().focus().setTextSelection({ from, to }).run()
}

function resolvePreferredSelectionRange(
	inMemorySelectionRange: MessageEditorSelectionRange | null,
	selectionPersistenceKey?: string,
): MessageEditorSelectionRange | null {
	return inMemorySelectionRange ?? getPersistedSelectionRange(selectionPersistenceKey)
}

function getPersistedSelectionRange(
	selectionPersistenceKey?: string,
): MessageEditorSelectionRange | null {
	if (!selectionPersistenceKey) return null
	const selectionRange = persistedSelectionRangeMap.get(selectionPersistenceKey)
	if (!selectionRange) return null
	return {
		from: selectionRange.from,
		to: selectionRange.to,
	}
}

function setPersistedSelectionRange(
	selectionPersistenceKey: string | undefined,
	selectionRange: MessageEditorSelectionRange,
) {
	if (!selectionPersistenceKey) return
	persistedSelectionRangeMap.delete(selectionPersistenceKey)
	persistedSelectionRangeMap.set(selectionPersistenceKey, {
		from: selectionRange.from,
		to: selectionRange.to,
	})
	while (persistedSelectionRangeMap.size > MAX_PERSISTED_SELECTION_RANGE_COUNT) {
		const oldestKey = persistedSelectionRangeMap.keys().next().value
		if (!oldestKey) break
		persistedSelectionRangeMap.delete(oldestKey)
	}
}
