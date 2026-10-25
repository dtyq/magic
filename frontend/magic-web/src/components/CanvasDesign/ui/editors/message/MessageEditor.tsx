import {
	forwardRef,
	useImperativeHandle,
	useRef,
	useEffect,
	useCallback,
	useMemo,
	type ClipboardEvent,
} from "react"
import { useEditor, EditorContent, type Editor } from "@/infrastructure/editors/tiptap/react"
import type { Extension, Node as TiptapNode } from "@/infrastructure/editors/tiptap/core"
import Document from "@/infrastructure/editors/tiptap/extension-document"
import Paragraph from "@/infrastructure/editors/tiptap/extension-paragraph"
import Text from "@/infrastructure/editors/tiptap/extension-text"
import HardBreak from "@/infrastructure/editors/tiptap/extension-hard-break"
import Placeholder from "@/infrastructure/editors/tiptap/extension-placeholder"
import { UndoRedo } from "@/infrastructure/editors/tiptap/extensions"
import { Fragment } from "@/infrastructure/editors/tiptap/pm-model"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type {
	MentionDataServicePort,
	ReferenceResourcePanelFileData,
	ReferenceResourcePanelItem,
} from "../../../public/props"
import { useOverflowChange } from "../../../app/hooks/layout/useOverflowChange"
import {
	getStringFromContent,
	getContentFromString,
	getMatchableMentionNamesFromValue,
	getMentionPathBindingsFromContent,
	getMentionNamesFromContent,
	getMentionPathsFromContent,
	areMentionPathBindingsEqual,
	MENTION_CARET_GUARD_TEXT,
	type MatchableMentionItem,
	type MentionPathBinding,
} from "./tiptap/contentUtils"
import styles from "./index.module.css"
import tiptapStyles from "./tiptap-editor.module.css"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"
import {
	serializeMessageClipboard,
	writeMessageClipboardPayload,
} from "@/utils/messageClipboardSerializer"

interface MentionEditorCommands {
	updateMentionEnabled?: (enabled: boolean) => boolean
	openMentionPanel?: () => boolean
}

interface MessageEditorProps {
	/** 禁止编辑但保留文本选择和标准剪贴板复制。 */
	readOnly?: boolean
	value?: string
	onChange?: (value: string) => void
	placeholder?: string
	onEnter?: () => void
	autoFocus?: boolean
	/** 与 autoFocus 联用：为 true 时忽略持久化选区并将光标移到文档末尾（如失败重试后进入编辑） */
	autoFocusAtDocumentEnd?: boolean
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
	onMentionChange?: (
		paths: string[],
		currentPrompt: string,
		context: MessageEditorMentionChangeContext,
	) => void
	/** hover 在某个 @ 提及项上时回调对应 path，离开时回调 null */
	onMentionItemHoverChange?: (path: string | null) => void
	onPendingUploadChange?: (items: MessageEditorPendingUploadMentionSnapshot[]) => void
	/** 是否启用 @ 功能（模型列表加载完成后才为 true） */
	mentionEnabled?: boolean
	/** 外部资源列表尚未恢复完成时，暂不发出 ready mention 快照。 */
	mentionItemsReady?: boolean
	/** 恢复期间按 mention 出现顺序重建真实资源路径；仅消费一次。 */
	mentionBindings?: MentionPathBinding[]
	/** 为 true 时外层与编辑区宽度 100% 铺满父级（用于视频生成等较宽面板） */
	fullWidth?: boolean
	onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void
	/** Capture phase is used by the shared Canvas clipboard protocol. */
	onPasteCapture?: (event: ClipboardEvent<HTMLDivElement>) => void
	/** Expand canvas-relative mention paths before writing magic clipboard metadata. */
	enrichClipboardMentionAttrs?: (attrs: TiptapMentionAttributes) => TiptapMentionAttributes
}

export interface MessageEditorMentionChangeContext {
	source: "user" | "sync"
	status: "pending" | "ready"
	revision: number
}

export type MessageEditorMentionMatcher = (item: ReferenceResourcePanelItem) => boolean

/** insertMentionItems 的可选行为（如上传/模式切换需在文末追加 @，与 appendMentionToString 一致） */
export interface InsertCanvasMentionItemsOptions {
	placement?: "cursor" | "documentEnd"
	/** 默认替换当前选区；为 false 时折叠到选区末尾插入，避免覆盖已选文本。 */
	replaceSelection?: boolean
	/** 粘贴开始时捕获的选区，供异步资源解析完成后稳定恢复插入位置。 */
	selection?: MessageEditorSelectionRange
}

export type MessageEditorClipboardInsertPart =
	| { type: "text"; text: string }
	| { type: "mention"; item: ReferenceResourcePanelItem }
	| { type: "pending"; item: MessageEditorPendingUploadMentionInput }

export interface MessageEditorSelectionRange {
	from: number
	to: number
}

export interface MessageEditorPendingUploadMentionInput {
	pendingId: string
	fileName: string
	fileExtension?: string
	fileSize?: number
	progress?: number
	status?: "init" | "uploading" | "done" | "error"
	error?: string
}

export interface MessageEditorPendingUploadMentionSnapshot extends MessageEditorPendingUploadMentionInput {
	pending: true
}

interface MessageEditorMentionSnapshot {
	paths: string[]
	currentPrompt: string
}

const PENDING_UPLOAD_MENTION_TRANSACTION_META = "canvasPendingUploadMentionMutation"

const MAX_PERSISTED_SELECTION_RANGE_COUNT = 200
const persistedSelectionRangeMap = new Map<string, MessageEditorSelectionRange>()

function createEditorSessionId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID()
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export interface MessageEditorRef {
	focus: () => void
	/** 当前编辑器实例的生命周期 identity；用于忽略卸载后回流的上传回调。 */
	getSessionId?: () => string
	/** 获取当前 ProseMirror 选区，供异步粘贴操作捕获起始位置。 */
	getSelectionRange?: () => MessageEditorSelectionRange | null
	/** 获取编辑器当前的内容（字符串形式） */
	getCurrentPrompt: () => string
	/** 获取编辑器当前按出现顺序保存的结构化 mention 路径绑定。 */
	getMentionBindings: () => MentionPathBinding[]
	openMentionPanel: () => void
	insertMentionItem: (
		item: ReferenceResourcePanelItem,
		options?: InsertCanvasMentionItemsOptions,
	) => boolean
	insertMentionItems: (
		items: ReferenceResourcePanelItem[],
		options?: InsertCanvasMentionItemsOptions,
	) => boolean
	insertClipboardParts: (
		parts: MessageEditorClipboardInsertPart[],
		options?: InsertCanvasMentionItemsOptions,
	) => boolean
	insertPendingUploadMentions: (
		items: MessageEditorPendingUploadMentionInput[],
		options?: InsertCanvasMentionItemsOptions,
	) => boolean
	updatePendingUploadMention: (
		pendingId: string,
		patch: Partial<
			Pick<MessageEditorPendingUploadMentionInput, "progress" | "status" | "error">
		>,
	) => boolean
	resolvePendingUploadMention: (pendingId: string, item: ReferenceResourcePanelItem) => boolean
	failPendingUploadMention: (pendingId: string, error: string) => boolean
	removePendingUploadMention: (pendingId: string) => boolean
	getPendingUploadMentions: () => MessageEditorPendingUploadMentionSnapshot[]
	hasPendingUploadMentions: () => boolean
	removeMentionItems: (matcher: MessageEditorMentionMatcher) => boolean
	replaceMentionItems: (
		matcher: MessageEditorMentionMatcher,
		item: ReferenceResourcePanelItem,
	) => boolean
}

const MessageEditor = forwardRef<MessageEditorRef, MessageEditorProps>(
	function MessageEditor(props, ref) {
		const {
			readOnly = false,
			value,
			onChange,
			placeholder,
			onEnter,
			autoFocus = false,
			autoFocusAtDocumentEnd = false,
			selectionPersistenceKey,
			onScrollbarChange,
			matchableItems = [],
			mentionExtension: injectedMentionExtension,
			onMentionChange,
			onMentionItemHoverChange,
			onPendingUploadChange,
			mentionEnabled = true,
			mentionItemsReady = true,
			mentionBindings = [],
			fullWidth = false,
			onPaste,
			onPasteCapture,
			enrichClipboardMentionAttrs,
		} = props
		const editorContainerRef = useRef<HTMLDivElement>(null)
		const enrichClipboardMentionAttrsRef = useRef(enrichClipboardMentionAttrs)
		enrichClipboardMentionAttrsRef.current = enrichClipboardMentionAttrs
		const isInternalChangeRef = useRef(false)
		// 进入编辑且要求文末聚焦时，在用户真正输入前，setContent（如 mention 二次解析）后仍钉回文末。
		const pinCaretToDocumentEndRef = useRef(autoFocusAtDocumentEnd)
		const latestFocusedSelectionRangeRef = useRef<MessageEditorSelectionRange | null>(null)
		const onEnterRef = useRef(onEnter)
		onEnterRef.current = readOnly ? undefined : onEnter
		// useEditor 仅依赖 mentionExtension；其余走 ref，避免整编辑器重建失焦
		const onChangeRef = useRef(onChange)
		onChangeRef.current = onChange
		const onMentionChangeRef = useRef(onMentionChange)
		onMentionChangeRef.current = onMentionChange
		const onMentionItemHoverChangeRef = useRef(onMentionItemHoverChange)
		const onPendingUploadChangeRef = useRef(onPendingUploadChange)
		onMentionItemHoverChangeRef.current = onMentionItemHoverChange
		onPendingUploadChangeRef.current = onPendingUploadChange
		const placeholderRef = useRef(placeholder ?? "")
		placeholderRef.current = placeholder ?? ""
		const hoveredMentionPathRef = useRef<string | null>(null)
		const editorSessionIdRef = useRef(createEditorSessionId())
		const lastMentionSnapshotRef = useRef<MessageEditorMentionSnapshot | null>(null)
		const mentionSyncRevisionRef = useRef(0)
		const pendingMentionBindingsRef = useRef<MentionPathBinding[] | null>(null)
		const latestMentionBindingsRef = useRef(mentionBindings)
		latestMentionBindingsRef.current = mentionBindings

		useEffect(() => {
			pendingMentionBindingsRef.current = mentionBindings.length ? [...mentionBindings] : null
		}, [mentionBindings])

		useEffect(() => {
			pinCaretToDocumentEndRef.current = autoFocusAtDocumentEnd
		}, [autoFocusAtDocumentEnd])

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
		const syncSelectionRange = useCallback(
			(selectionRange: MessageEditorSelectionRange) => {
				latestFocusedSelectionRangeRef.current = selectionRange
				setPersistedSelectionRange(selectionPersistenceKey, selectionRange)
			},
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
				editable: !readOnly,
				extensions,
				content: getContentFromString(value ?? "", matchableItems, mentionBindings),
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
				onUpdate: ({ editor: e, transaction }) => {
					if (!e.isEditable) return
					if (isInternalChangeRef.current) return
					if (transaction.getMeta(PENDING_UPLOAD_MENTION_TRANSACTION_META) === true)
						return
					// 用户开始编辑后不再强制钉文末，避免后续外部 setContent 抢走光标。
					pinCaretToDocumentEndRef.current = false
					const str = getStringFromContent(e.getJSON())
					onChangeRef.current?.(str)
					const mentionCb = onMentionChangeRef.current
					if (mentionCb) {
						const paths = getMentionPathsFromContent(e.getJSON())
						lastMentionSnapshotRef.current = {
							paths: [...paths],
							currentPrompt: str,
						}
						mentionCb(paths, str, {
							source: "user",
							status: "ready",
							revision: (mentionSyncRevisionRef.current += 1),
						})
					}
				},
				onSelectionUpdate: ({ editor: e }) => {
					if (!e.isFocused) return
					const selectionRange = {
						from: e.state.selection.from,
						to: e.state.selection.to,
					}
					syncSelectionRange(selectionRange)
				},
			},
			// 此处依赖变化会整段销毁 TipTap，仅保留 mentionExtension
			[mentionExtension],
		)

		useEffect(() => {
			editor?.setEditable(!readOnly, false)
		}, [editor, readOnly])

		const handleCopyCapture = useCallback(
			(event: ClipboardEvent<HTMLDivElement>) => {
				if (!editor || editor.isDestroyed || !event.clipboardData) return
				const payload = serializeMessageClipboard(editor.view, {
					enrichMentionAttrs: enrichClipboardMentionAttrsRef.current,
				})
				if (!payload) return

				event.preventDefault()
				event.stopPropagation()
				writeMessageClipboardPayload(event.clipboardData, payload)
			},
			[editor],
		)

		useImperativeHandle(ref, () => ({
			getSessionId: () => editorSessionIdRef.current,
			focus: () => {
				if (!editor || editor.isDestroyed) return
				focusEditorWithPreservedSelection(editor, getPreferredSelectionRange())
			},
			getSelectionRange: () => {
				if (!editor || editor.isDestroyed) return null
				return {
					from: editor.state.selection.from,
					to: editor.state.selection.to,
				}
			},
			getCurrentPrompt: () => {
				if (!editor) return ""
				return getStringFromContent(editor.getJSON())
			},
			getMentionBindings: () => {
				if (!editor) return []
				return getMentionPathBindingsFromContent(editor.getJSON())
			},
			openMentionPanel: () => {
				if (!editor || !mentionExtension || !mentionEnabled) return
				;(editor.commands as MentionEditorCommands).openMentionPanel?.()
			},
			insertMentionItem: (
				item: ReferenceResourcePanelItem,
				options?: InsertCanvasMentionItemsOptions,
			) => {
				if (!editor) return false
				return insertMentionItemsToEditor(
					editor,
					[item],
					options,
					getPreferredSelectionRange,
					syncSelectionRange,
				)
			},
			insertMentionItems: (
				items: ReferenceResourcePanelItem[],
				options?: InsertCanvasMentionItemsOptions,
			) => {
				if (!editor) return false
				return insertMentionItemsToEditor(
					editor,
					items,
					options,
					getPreferredSelectionRange,
					syncSelectionRange,
				)
			},
			insertClipboardParts: (
				parts: MessageEditorClipboardInsertPart[],
				options?: InsertCanvasMentionItemsOptions,
			) => {
				if (!editor) return false
				const didInsert = insertClipboardPartsToEditor(
					editor,
					parts,
					options,
					getPreferredSelectionRange,
					syncSelectionRange,
				)
				if (didInsert && parts.some((part) => part.type === "pending")) {
					onPendingUploadChangeRef.current?.(getPendingUploadMentionSnapshots(editor))
				}
				return didInsert
			},
			insertPendingUploadMentions: (
				items: MessageEditorPendingUploadMentionInput[],
				options?: InsertCanvasMentionItemsOptions,
			) => {
				if (!editor || items.length === 0) return false
				const didInsert = insertPendingUploadMentionsToEditor(
					editor,
					items,
					options,
					getPreferredSelectionRange,
					syncSelectionRange,
				)
				if (didInsert) {
					onPendingUploadChangeRef.current?.(getPendingUploadMentionSnapshots(editor))
				}
				return didInsert
			},
			updatePendingUploadMention: (pendingId, patch) => {
				if (!editor) return false
				const didUpdate = updatePendingUploadMentionInEditor(editor, pendingId, patch)
				if (didUpdate) {
					onPendingUploadChangeRef.current?.(getPendingUploadMentionSnapshots(editor))
				}
				return didUpdate
			},
			resolvePendingUploadMention: (pendingId, item) => {
				if (!editor) return false
				const didResolve = resolvePendingUploadMentionInEditor(editor, pendingId, item)
				if (didResolve) {
					onPendingUploadChangeRef.current?.(getPendingUploadMentionSnapshots(editor))
				}
				return didResolve
			},
			failPendingUploadMention: (pendingId, error) => {
				if (!editor) return false
				const didFail = failPendingUploadMentionInEditor(editor, pendingId, error)
				if (didFail) {
					onPendingUploadChangeRef.current?.(getPendingUploadMentionSnapshots(editor))
				}
				return didFail
			},
			removePendingUploadMention: (pendingId) => {
				if (!editor) return false
				const didRemove = removeMentionItemsInEditor(
					editor,
					(item) => item.pending === true && item.pendingId === pendingId,
					syncSelectionRange,
					PENDING_UPLOAD_MENTION_TRANSACTION_META,
				)
				if (didRemove) {
					onPendingUploadChangeRef.current?.(getPendingUploadMentionSnapshots(editor))
				}
				return didRemove
			},
			getPendingUploadMentions: () => {
				if (!editor) return []
				return getPendingUploadMentionSnapshots(editor)
			},
			hasPendingUploadMentions: () => {
				if (!editor) return false
				return getPendingUploadMentionSnapshots(editor).length > 0
			},
			removeMentionItems: (matcher: MessageEditorMentionMatcher) => {
				if (!editor) return false
				return removeMentionItemsInEditor(editor, matcher, syncSelectionRange)
			},
			replaceMentionItems: (
				matcher: MessageEditorMentionMatcher,
				item: ReferenceResourcePanelItem,
			) => {
				if (!editor) return false
				return replaceMentionItemsInEditor(editor, matcher, item)
			},
		}))

		// value 变化时 setContent；matchableItems 延迟到达时（挂载后 syncFromElement 完成）需重新解析以恢复 @mention 样式。
		// 推迟到 microtask：TipTap 为 Mention 等 NodeView 创建 ReactRenderer 时会 flushSync，若在 React effect 栈内同步 setContent 会触发警告。
		useEffect(() => {
			if (!editor) return

			const valueSnapshot = value ?? ""
			const itemsSnapshot = matchableItems
			const syncRevision = (mentionSyncRevisionRef.current += 1)
			const mentionCb = onMentionChangeRef.current
			if (mentionCb) {
				runActiveEditor(editor, (activeEditor) => {
					mentionCb(
						getMentionPathsFromContent(activeEditor.getJSON()),
						getStringFromContent(activeEditor.getJSON()),
						{ source: "sync", status: "pending", revision: syncRevision },
					)
				})
			}
			const syncMentionChange = (activeEditor: Editor) => {
				const mentionCb = onMentionChangeRef.current
				if (!mentionCb) return
				if (!mentionItemsReady) return
				const paths = getMentionPathsFromContent(activeEditor.getJSON())
				const currentPrompt = getStringFromContent(activeEditor.getJSON())
				const previousSnapshot = lastMentionSnapshotRef.current
				const isSameSnapshot =
					previousSnapshot?.currentPrompt === currentPrompt &&
					previousSnapshot.paths.length === paths.length &&
					previousSnapshot.paths.every((path, index) => path === paths[index])
				if (isSameSnapshot) return
				lastMentionSnapshotRef.current = {
					paths: [...paths],
					currentPrompt,
				}
				mentionCb(paths, currentPrompt, {
					source: "sync",
					status: "ready",
					revision: syncRevision,
				})
			}
			let cancelled = false

			queueMicrotask(() => {
				runActiveEditor(editor, (activeEditor) => {
					if (cancelled) return

					const currentStr = getStringFromContent(activeEditor.getJSON())
					const pendingMentionBindings = pendingMentionBindingsRef.current
					const latestMentionBindings = latestMentionBindingsRef.current
					const bindingsForContent =
						(pendingMentionBindings && pendingMentionBindings.length > 0
							? pendingMentionBindings
							: null) ??
						(latestMentionBindings.length > 0 ? latestMentionBindings : [])
					const currentMentionBindings = getMentionPathBindingsFromContent(
						activeEditor.getJSON(),
					)
					const editorMentionNames = getMentionNamesFromContent(activeEditor.getJSON())
					const matchableMentionNames = getMatchableMentionNamesFromValue(
						valueSnapshot,
						itemsSnapshot,
					)
					// Existing mention nodes retain authoritative paths; compare names/counts here
					// so adding same-name candidates does not remap structured mentions.
					const editorMentionNameCounts = new Map<string, number>()
					for (const name of editorMentionNames) {
						const key = name.toLowerCase()
						editorMentionNameCounts.set(
							key,
							(editorMentionNameCounts.get(key) ?? 0) + 1,
						)
					}
					const matchableMentionNameCounts = new Map<string, number>()
					for (const name of matchableMentionNames) {
						const key = name.toLowerCase()
						matchableMentionNameCounts.set(
							key,
							(matchableMentionNameCounts.get(key) ?? 0) + 1,
						)
					}
					const hasMentionsRenderedAsText = Array.from(
						matchableMentionNameCounts.entries(),
					).some(([name, count]) => (editorMentionNameCounts.get(name) ?? 0) < count)
					const hasRestoredMentionBindingMismatch =
						bindingsForContent.length > 0 &&
						!areMentionPathBindingsEqual(currentMentionBindings, bindingsForContent)

					const pendingUploadCount = getPendingUploadMentionSnapshots(activeEditor).length
					// Pending upload chips are omitted from `value`. Syncing value while they
					// exist (common right after paste: value still "") would wipe placeholders
					// before host resolve/upload can promote them.
					if (pendingUploadCount > 0) {
						pendingMentionBindingsRef.current = null
						return
					}

					if (currentStr !== valueSnapshot || hasRestoredMentionBindingMismatch) {
						const contentToSet = getContentFromString(
							valueSnapshot,
							itemsSnapshot,
							bindingsForContent,
						)
						isInternalChangeRef.current = true
						activeEditor.commands.setContent(contentToSet, {
							emitUpdate: false,
						})
						pendingMentionBindingsRef.current = null
						restorePinnedCaretToDocumentEnd(activeEditor, pinCaretToDocumentEndRef)
						syncMentionChange(activeEditor)
						queueMicrotask(() => {
							isInternalChangeRef.current = false
						})
						return
					}

					if (hasMentionsRenderedAsText) {
						const contentToSet = getContentFromString(
							valueSnapshot,
							itemsSnapshot,
							bindingsForContent,
						)
						isInternalChangeRef.current = true
						activeEditor.commands.setContent(contentToSet, {
							emitUpdate: false,
						})
						pendingMentionBindingsRef.current = null
						restorePinnedCaretToDocumentEnd(activeEditor, pinCaretToDocumentEndRef)
						syncMentionChange(activeEditor)
						queueMicrotask(() => {
							isInternalChangeRef.current = false
						})
						return
					}

					pendingMentionBindingsRef.current = null
					syncMentionChange(activeEditor)
				})
			})

			return () => {
				cancelled = true
			}
		}, [value, matchableItems, editor, mentionItemsReady, mentionBindings])

		// 空文档时占位文案变更：空事务触发占位装饰重算（不重建 editor）
		useEffect(() => {
			placeholderRef.current = placeholder ?? ""
			if (!editor) return
			const isEmpty = runActiveEditor(editor, (activeEditor) => activeEditor.isEmpty, false)
			if (!isEmpty) return
			queueMicrotask(() => {
				runActiveEditor(editor, (activeEditor) => {
					activeEditor.view.dispatch(activeEditor.state.tr)
				})
			})
		}, [placeholder, editor])

		useEffect(() => {
			checkScrollbar()
		}, [checkScrollbar])

		useEffect(() => {
			if (!autoFocus || !editor) return
			const timer = window.setTimeout(() => {
				runActiveEditor(editor, (activeEditor) => {
					if (autoFocusAtDocumentEnd) activeEditor.commands.focus("end")
					else
						focusEditorWithPreservedSelection(
							activeEditor,
							getPreferredSelectionRange(),
						)
				})
			}, 50)
			return () => window.clearTimeout(timer)
		}, [autoFocus, autoFocusAtDocumentEnd, editor, getPreferredSelectionRange])

		useEffect(() => {
			const timer = setTimeout(checkScrollbar, 0)
			return () => clearTimeout(timer)
		}, [value, checkScrollbar])

		useEffect(() => {
			if (!editor || !mentionExtension) return
			runActiveEditor(editor, (activeEditor) => {
				;(activeEditor.commands as MentionEditorCommands).updateMentionEnabled?.(
					mentionEnabled,
				)
			})
		}, [editor, mentionExtension, mentionEnabled])

		useEffect(() => {
			if (!editor) return

			function getHoveredMentionPath(target: EventTarget | null): string | null {
				if (!(target instanceof Element)) return null
				const mentionEl = target.closest<HTMLElement>(".canvas-project-file-mention")
				if (mentionEl?.dataset.deleted === "true") return null
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
				onCopyCapture={handleCopyCapture}
				onPaste={onPaste}
				onPasteCapture={onPasteCapture}
				data-testid="canvas-reference-editor-container"
			>
				<div ref={editorContainerRef} className={styles.editorWrapper}>
					<EditorContent editor={editor} className={tiptapStyles.tiptapEditor} />
				</div>
			</div>
		)
	},
)

function createPendingUploadMentionAttrs(
	item: MessageEditorPendingUploadMentionInput,
): TiptapMentionAttributes {
	return {
		type: "project_file",
		pending: true,
		pendingId: item.pendingId,
		data: {
			file_id: `pending:${item.pendingId}`,
			file_name: item.fileName,
			file_path: "",
			relative_file_path: "",
			file_extension:
				item.fileExtension ||
				(item.fileName.includes(".") ? (item.fileName.split(".").pop() ?? "") : ""),
			file_size: item.fileSize,
			pending: true,
			pending_id: item.pendingId,
			upload_progress: normalizeUploadProgress(item.progress ?? 0),
			upload_status: item.status ?? "init",
			upload_error: item.error,
		} as TiptapMentionAttributes["data"],
	}
}

function insertClipboardPartsToEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	parts: MessageEditorClipboardInsertPart[],
	options?: InsertCanvasMentionItemsOptions,
	getLatestFocusedSelectionRange?: () => MessageEditorSelectionRange | null,
	onSelectionRangeChange?: (selectionRange: MessageEditorSelectionRange) => void,
): boolean {
	if (parts.length === 0) return false

	const content: Array<Record<string, unknown>> = []
	let hasPendingMention = false
	for (const part of parts) {
		if (part.type === "mention") {
			content.push({ type: "mention", attrs: part.item })
			content.push({ type: "text", text: MENTION_CARET_GUARD_TEXT })
			continue
		}
		if (part.type === "pending") {
			hasPendingMention = true
			content.push({ type: "mention", attrs: createPendingUploadMentionAttrs(part.item) })
			content.push({ type: "text", text: MENTION_CARET_GUARD_TEXT })
			continue
		}
		const lines = part.text.replace(/\r\n?/g, "\n").split("\n")
		lines.forEach((line, index) => {
			if (line) content.push({ type: "text", text: line })
			if (index < lines.length - 1) content.push({ type: "hardBreak" })
		})
	}
	if (content.length === 0) return false

	const didInsert =
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (
					content.some((node) => node.type === "mention") &&
					!activeEditor.schema.nodes.mention
				) {
					return false
				}
				const fragment = Fragment.fromArray(
					content.map((node) => activeEditor.schema.nodeFromJSON(node)),
				)
				const shouldUsePreservedSelection =
					options?.placement !== "documentEnd" &&
					(Boolean(options?.selection) || !activeEditor.isFocused)
				const chain = activeEditor.chain()
				if (options?.placement === "documentEnd") {
					chain.focus("end", { scrollIntoView: false })
				} else {
					chain.focus(undefined, { scrollIntoView: false })
				}
				return chain
					.command(({ tr, commands }) => {
						if (hasPendingMention) {
							tr.setMeta(PENDING_UPLOAD_MENTION_TRANSACTION_META, true)
						}
						const preservedSelection = shouldUsePreservedSelection
							? (options?.selection ?? getLatestFocusedSelectionRange?.())
							: null
						const maxPos = Math.max(1, tr.doc.content.size)
						const insertionRange = resolveMentionInsertionRange({
							currentSelection: tr.selection,
							preservedSelection,
							maxPos,
							replaceSelection: options?.replaceSelection !== false,
						})
						if (
							!commands.insertContentAt(
								{ from: insertionRange.from, to: insertionRange.to },
								content,
								{ updateSelection: false },
							)
						) {
							return false
						}
						const nextSelectionPosition = insertionRange.from + fragment.size
						if (!commands.setTextSelection(nextSelectionPosition)) return false
						onSelectionRangeChange?.({
							from: nextSelectionPosition,
							to: nextSelectionPosition,
						})
						return true
					})
					.run()
			},
			false,
		) ?? false
	if (didInsert) restoreEditorFocusAfterMentionMutation(editor)
	return didInsert
}

function insertPendingUploadMentionsToEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	items: MessageEditorPendingUploadMentionInput[],
	options?: InsertCanvasMentionItemsOptions,
	getLatestFocusedSelectionRange?: () => MessageEditorSelectionRange | null,
	onSelectionRangeChange?: (selectionRange: MessageEditorSelectionRange) => void,
): boolean {
	const mentionItems = items.map((item) => createPendingUploadMentionAttrs(item))

	return insertMentionItemsToEditor(
		editor,
		mentionItems as ReferenceResourcePanelItem[],
		options,
		getLatestFocusedSelectionRange,
		onSelectionRangeChange,
		PENDING_UPLOAD_MENTION_TRANSACTION_META,
	)
}

function updatePendingUploadMentionInEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	pendingId: string,
	patch: Partial<Pick<MessageEditorPendingUploadMentionInput, "progress" | "status" | "error">>,
): boolean {
	return mutatePendingUploadMentionInEditor(editor, pendingId, (attrs) => {
		const data = asMentionDataRecord(attrs.data)
		return {
			...attrs,
			pending: true,
			pendingId,
			data: {
				...data,
				pending: true,
				pending_id: pendingId,
				...(patch.progress === undefined
					? {}
					: { upload_progress: normalizeUploadProgress(patch.progress) }),
				...(patch.status === undefined ? {} : { upload_status: patch.status }),
				...(patch.error === undefined ? {} : { upload_error: patch.error }),
			} as TiptapMentionAttributes["data"],
		}
	})
}

function resolvePendingUploadMentionInEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	pendingId: string,
	item: ReferenceResourcePanelItem,
): boolean {
	const didResolve = mutatePendingUploadMentionInEditor(
		editor,
		pendingId,
		(attrs) => ({
			...attrs,
			...item,
			pending: false,
			pendingId: undefined,
			data: stripPendingUploadData(item.data) as TiptapMentionAttributes["data"],
		}),
		{ internalOnly: false },
	)
	return didResolve
}

function failPendingUploadMentionInEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	pendingId: string,
	error: string,
): boolean {
	const didFail = updatePendingUploadMentionInEditor(editor, pendingId, {
		status: "error",
		error,
	})
	return didFail
}

function getPendingUploadMentionSnapshots(
	editor: NonNullable<ReturnType<typeof useEditor>>,
): MessageEditorPendingUploadMentionSnapshot[] {
	return (
		runActiveEditor(
			editor,
			(activeEditor) => {
				const snapshots: MessageEditorPendingUploadMentionSnapshot[] = []
				activeEditor.state.doc.descendants((node) => {
					if (node.type.name !== "mention") return true
					const attrs = node.attrs as TiptapMentionAttributes
					if (attrs.pending !== true || !attrs.pendingId) return true
					const data = asMentionDataRecord(attrs.data)
					snapshots.push({
						pending: true,
						pendingId: attrs.pendingId,
						fileName: String(data.file_name || ""),
						fileExtension: String(data.file_extension || ""),
						fileSize: toOptionalNumber(data.file_size),
						progress: toOptionalNumber(data.upload_progress),
						status: isPendingUploadStatus(data.upload_status)
							? data.upload_status
							: "init",
						error:
							typeof data.upload_error === "string" ? data.upload_error : undefined,
					})
					return true
				})
				return snapshots
			},
			[],
		) ?? []
	)
}

function mutatePendingUploadMentionInEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	pendingId: string,
	createAttrs: (attrs: TiptapMentionAttributes) => TiptapMentionAttributes,
	options: { internalOnly?: boolean } = {},
): boolean {
	const didMutate =
		runActiveEditor(
			editor,
			(activeEditor) => {
				const targets: Array<{ attrs: TiptapMentionAttributes; pos: number }> = []
				activeEditor.state.doc.descendants((node, pos) => {
					if (node.type.name !== "mention") return true
					const attrs = node.attrs as TiptapMentionAttributes
					if (attrs.pending !== true || attrs.pendingId !== pendingId) return true
					targets.push({ attrs, pos })
					return true
				})
				if (targets.length === 0) return false

				const tr = activeEditor.state.tr
				for (const target of targets) {
					tr.setNodeMarkup(target.pos, undefined, createAttrs(target.attrs))
				}
				if (options.internalOnly !== false) {
					tr.setMeta(PENDING_UPLOAD_MENTION_TRANSACTION_META, true)
				}
				activeEditor.view.dispatch(tr)
				return true
			},
			false,
		) === true
	return didMutate
}

function asMentionDataRecord(data: TiptapMentionAttributes["data"]): Record<string, unknown> {
	return data && typeof data === "object" ? (data as Record<string, unknown>) : {}
}

function stripPendingUploadData(data: ReferenceResourcePanelItem["data"]): Record<string, unknown> {
	const result = { ...asMentionDataRecord(data as TiptapMentionAttributes["data"]) }
	delete result.pending
	delete result.pending_id
	delete result.upload_progress
	delete result.upload_status
	delete result.upload_error
	return result
}

function normalizeUploadProgress(progress: number): number {
	if (!Number.isFinite(progress)) return 0
	return Math.min(100, Math.max(0, Math.round(progress)))
}

function toOptionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isPendingUploadStatus(
	value: unknown,
): value is NonNullable<MessageEditorPendingUploadMentionInput["status"]> {
	return value === "init" || value === "uploading" || value === "done" || value === "error"
}

function insertMentionItemsToEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	items: ReferenceResourcePanelItem[],
	options?: InsertCanvasMentionItemsOptions,
	getLatestFocusedSelectionRange?: () => MessageEditorSelectionRange | null,
	onSelectionRangeChange?: (selectionRange: MessageEditorSelectionRange) => void,
	transactionMeta?: string,
) {
	if (items.length === 0) return false

	const didInsert =
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.schema.nodes.mention) return false
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

				const fragment = Fragment.fromArray(
					content.map((node) => activeEditor.schema.nodeFromJSON(node)),
				)
				const fragSize = fragment.size
				const shouldUsePreservedSelection =
					options?.placement !== "documentEnd" &&
					(Boolean(options?.selection) || !activeEditor.isFocused)

				const chain = activeEditor.chain()
				if (options?.placement === "documentEnd") {
					chain.focus("end", { scrollIntoView: false })
				} else {
					chain.focus(undefined, { scrollIntoView: false })
				}
				return chain
					.command(({ tr, commands }) => {
						if (transactionMeta) tr.setMeta(transactionMeta, true)
						const currentSelection = tr.selection
						const preservedSelection = shouldUsePreservedSelection
							? (options?.selection ?? getLatestFocusedSelectionRange?.())
							: null
						const maxPos = Math.max(1, tr.doc.content.size)
						const insertionRange = resolveMentionInsertionRange({
							currentSelection,
							preservedSelection,
							maxPos,
							replaceSelection: options?.replaceSelection !== false,
						})
						const { from: insertFrom, to: insertTo } = insertionRange
						if (
							!commands.insertContentAt({ from: insertFrom, to: insertTo }, content, {
								updateSelection: false,
							})
						) {
							return false
						}
						const nextSelectionPosition = insertFrom + fragSize
						if (!commands.setTextSelection(nextSelectionPosition)) {
							return false
						}
						onSelectionRangeChange?.({
							from: nextSelectionPosition,
							to: nextSelectionPosition,
						})
						return true
					})
					.run()
			},
			false,
		) ?? false

	if (didInsert) restoreEditorFocusAfterMentionMutation(editor)

	return didInsert
}

export function resolveMentionInsertionRange(options: {
	currentSelection: MessageEditorSelectionRange
	preservedSelection?: MessageEditorSelectionRange | null
	maxPos: number
	replaceSelection: boolean
}): MessageEditorSelectionRange {
	const { currentSelection, preservedSelection, maxPos, replaceSelection } = options
	const selection = preservedSelection ?? currentSelection
	// doc.content.size 包含最外层文本块的闭合边界；该边界位于段落外，不能用于内联 mention 插入。
	const maxTextPosition = Math.max(1, maxPos - 1)
	const from = Math.min(Math.max(selection.from, 1), maxTextPosition)
	const to = Math.min(Math.max(selection.to, from), maxTextPosition)
	if (replaceSelection) return { from, to }
	return { from: to, to }
}

function replaceMentionItemsInEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	matcher: MessageEditorMentionMatcher,
	item: ReferenceResourcePanelItem,
): boolean {
	const didReplace =
		runActiveEditor(
			editor,
			(activeEditor) => {
				const targetPositions: number[] = []
				activeEditor.state.doc.descendants((node, pos) => {
					if (node.type.name !== "mention") return true
					if (!matcher(node.attrs as ReferenceResourcePanelItem)) return true
					targetPositions.push(pos)
					return true
				})

				if (targetPositions.length === 0) return false

				const tr = activeEditor.state.tr
				targetPositions.forEach((targetPos) => {
					tr.setNodeMarkup(targetPos, undefined, item)
				})
				activeEditor.view.dispatch(tr)
				return true
			},
			false,
		) === true

	if (didReplace) restoreEditorFocusAfterMentionMutation(editor)
	return didReplace
}

function removeMentionItemsInEditor(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	matcher: MessageEditorMentionMatcher,
	onSelectionRangeChange?: (selectionRange: MessageEditorSelectionRange) => void,
	transactionMeta?: string,
): boolean {
	const didRemove =
		runActiveEditor(
			editor,
			(activeEditor) => {
				const targetRanges: Array<{ from: number; to: number }> = []
				activeEditor.state.doc.descendants((node, pos) => {
					if (node.type.name !== "mention") return true
					if (!matcher(node.attrs as ReferenceResourcePanelItem)) return true

					const mentionEnd = pos + node.nodeSize
					const nextNode = activeEditor.state.doc.resolve(mentionEnd).nodeAfter
					const hasCaretGuard =
						nextNode?.isText === true &&
						nextNode.text?.startsWith(MENTION_CARET_GUARD_TEXT)
					targetRanges.push({
						from: pos,
						to: mentionEnd + (hasCaretGuard ? MENTION_CARET_GUARD_TEXT.length : 0),
					})
					return true
				})

				if (targetRanges.length === 0) return false

				const tr = activeEditor.state.tr
				targetRanges
					.sort((a, b) => b.from - a.from)
					.forEach(({ from, to }) => tr.delete(from, to))
				if (transactionMeta) tr.setMeta(transactionMeta, true)
				activeEditor.view.dispatch(tr)
				onSelectionRangeChange?.({
					from: activeEditor.state.selection.from,
					to: activeEditor.state.selection.to,
				})
				return true
			},
			false,
		) === true

	if (didRemove) restoreEditorFocusAfterMentionMutation(editor)
	return didRemove
}

/** 与“+ 添加媒体”保持一致：外部控件操作结束后，将光标恢复到编辑器当前选区。 */
function restoreEditorFocusAfterMentionMutation(editor: NonNullable<ReturnType<typeof useEditor>>) {
	setTimeout(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.commands.focus(undefined, { scrollIntoView: false })
		})
	}, 0)
}

export default MessageEditor

function focusEditorWithPreservedSelection(
	editor: NonNullable<ReturnType<typeof useEditor>>,
	selectionRange: MessageEditorSelectionRange | null,
) {
	runActiveEditor(editor, (activeEditor) => {
		if (!selectionRange) {
			activeEditor.commands.focus("end")
			return
		}

		const maxPos = Math.max(1, activeEditor.state.doc.content.size)
		const from = Math.min(Math.max(selectionRange.from, 1), maxPos)
		const to = Math.min(Math.max(selectionRange.to, from), maxPos)

		activeEditor.chain().focus().setTextSelection({ from, to }).run()
	})
}

/** setContent 会把选区重置到文首；进入编辑钉文末期间若已聚焦则立刻拉回末尾。 */
function restorePinnedCaretToDocumentEnd(
	activeEditor: Editor,
	pinCaretToDocumentEndRef: { current: boolean },
) {
	if (!pinCaretToDocumentEndRef.current) return
	if (!activeEditor.isFocused) return
	activeEditor.commands.focus("end")
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
