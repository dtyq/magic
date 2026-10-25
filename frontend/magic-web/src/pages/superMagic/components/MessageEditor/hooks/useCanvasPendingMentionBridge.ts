import { useCallback, useEffect, useRef } from "react"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import {
	getMentionUniqueId,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { getProjectFileResourceIdentity } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import { CANVAS_SELECTION_PENDING_MENTION_LIMIT } from "@/components/business/MentionPanel/runtime/builtin/domains/canvas-elements"
import {
	isCanvasSelectionMentionScopeInContext,
	type CanvasSelectionMentionScope,
	type SuperMagicCanvasSelectionMentionsPayload,
} from "@/pages/superMagic/events/message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface MentionSelectionRange {
	from: number
	to: number
}

interface UseCanvasPendingMentionBridgeOptions {
	editor: Editor | null
	enabled: boolean
	scope: Pick<CanvasSelectionMentionScope, "workspaceId" | "projectId" | "topicId">
}

function isEditorReady(editor: Editor | null): editor is Editor {
	return Boolean(editor && !editor.isDestroyed)
}

function getDocumentEndPosition(editor: Editor): number {
	return Math.max(1, editor.state.doc.content.size - 1)
}

function getValidSelectionRange(editor: Editor): MentionSelectionRange | null {
	const { from, to } = editor.state.selection
	const maxPosition = editor.state.doc.content.size
	if (from < 1 || to < from || to > maxPosition) return null
	return { from, to }
}

function getPendingInsertionRange(
	editor: Editor,
	lastSelection: MentionSelectionRange | null,
): MentionSelectionRange {
	return (
		(editor.isFocused ? getValidSelectionRange(editor) : lastSelection) ?? {
			from: getDocumentEndPosition(editor),
			to: getDocumentEndPosition(editor),
		}
	)
}

function getMentionResourceKey(attrs: TiptapMentionAttributes): string {
	if (attrs.type === MentionItemType.PROJECT_FILE) {
		const data = attrs.data as {
			file_id?: string | number
			file_path?: string
			relative_file_path?: string
		}
		const identity = getProjectFileResourceIdentity(data)
		if (identity) return identity
	}
	return getMentionUniqueId(attrs)
}

function collectFormalMentionIds(editor: Editor): Set<string> {
	const ids = new Set<string>()
	editor.state.doc.descendants((node) => {
		if (node.type.name !== "mention") return true
		const attrs = node.attrs as TiptapMentionAttributes
		if (!attrs.pending) ids.add(getMentionResourceKey(attrs))
		return true
	})
	return ids
}

function removePendingMentionNodes(editor: Editor, pendingIds: Set<string>): number {
	if (pendingIds.size === 0) return 0

	const ranges: Array<{ from: number; to: number }> = []
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name !== "mention") return true
		const attrs = node.attrs as TiptapMentionAttributes
		if (attrs.pending && attrs.pendingId && pendingIds.has(attrs.pendingId)) {
			ranges.push({ from: pos, to: pos + node.nodeSize })
		}
		return true
	})

	if (ranges.length === 0) return 0

	const transaction = editor.state.tr
	ranges.reverse().forEach(({ from, to }) => transaction.delete(from, to))
	editor.view.dispatch(transaction)
	return ranges.length
}

function promotePendingMentionNodes(editor: Editor, pendingIds: Set<string>): number {
	if (pendingIds.size === 0) return 0

	const transaction = editor.state.tr
	let count = 0

	editor.state.doc.descendants((node, pos) => {
		if (node.type.name !== "mention") return true
		const attrs = node.attrs as TiptapMentionAttributes
		if (!attrs.pending || !attrs.pendingId || !pendingIds.has(attrs.pendingId)) return true

		const formalAttrs = { ...attrs }
		delete formalAttrs.pending
		delete formalAttrs.pendingId
		transaction.setNodeMarkup(pos, undefined, formalAttrs)
		count += 1
		return true
	})

	if (count > 0) editor.view.dispatch(transaction)
	return count
}

function createPendingId(revision: string, index: number): string {
	return `canvas-selection:${revision}:${index}:${Date.now()}`
}

/**
 * Bridges the active Canvas selection into TipTap without taking browser focus.
 * The bridge owns only the pending ids it inserts, so replacing a selection
 * never removes ordinary file mentions already composed by the user.
 */
export function useCanvasPendingMentionBridge({
	editor,
	enabled,
	scope,
}: UseCanvasPendingMentionBridgeOptions) {
	const editorRef = useRef<Editor | null>(editor)
	const pendingIdsRef = useRef(new Set<string>())
	const sourceScopeKeyRef = useRef<string | null>(null)
	const lastSelectionRef = useRef<MentionSelectionRange | null>(null)
	const scopeRef = useRef(scope)

	useEffect(() => {
		const previousEditor = editorRef.current
		editorRef.current = editor
		if (previousEditor !== editor) {
			if (isEditorReady(previousEditor)) {
				removePendingMentionNodes(previousEditor, pendingIdsRef.current)
			}
			if (isEditorReady(editor)) {
				removePendingMentionNodes(editor, pendingIdsRef.current)
			}
			lastSelectionRef.current = null
			pendingIdsRef.current.clear()
			sourceScopeKeyRef.current = null
		}
		if (!isEditorReady(editor)) return

		const captureSelection = () => {
			if (!editor.isFocused) return
			lastSelectionRef.current = getValidSelectionRange(editor)
		}
		// A fresh editor has a schema-default selection at its first paragraph.
		// Do not treat that as a user cursor: an unfocused editor must append.
		editor.on("selectionUpdate", captureSelection)
		editor.on("focus", captureSelection)
		return () => {
			editor.off("selectionUpdate", captureSelection)
			editor.off("focus", captureSelection)
		}
	}, [editor])

	const clearPending = useCallback(() => {
		const activeEditor = editorRef.current
		if (isEditorReady(activeEditor)) {
			removePendingMentionNodes(activeEditor, pendingIdsRef.current)
		}
		pendingIdsRef.current.clear()
		sourceScopeKeyRef.current = null
	}, [])

	const promotePending = useCallback(() => {
		const activeEditor = editorRef.current
		if (!isEditorReady(activeEditor)) return
		promotePendingMentionNodes(activeEditor, pendingIdsRef.current)
		pendingIdsRef.current.clear()
		sourceScopeKeyRef.current = null
	}, [])

	const replacePending = useCallback(
		(payload: SuperMagicCanvasSelectionMentionsPayload) => {
			const activeEditor = editorRef.current
			if (!isEditorReady(activeEditor)) return

			const selection = getPendingInsertionRange(activeEditor, lastSelectionRef.current)
			const formalMentionIds = collectFormalMentionIds(activeEditor)
			clearPending()

			const nextItems = payload.items
				.filter((item, index, items) => {
					const uniqueId = getMentionResourceKey(item)
					return (
						!formalMentionIds.has(uniqueId) &&
						items.findIndex(
							(candidate) => getMentionResourceKey(candidate) === uniqueId,
						) === index
					)
				})
				.slice(0, CANVAS_SELECTION_PENDING_MENTION_LIMIT)
			if (nextItems.length === 0) return

			const insertPosition = Math.min(
				Math.max(selection.from, 1),
				getDocumentEndPosition(activeEditor),
			)
			const pendingItems = nextItems.map((item, index) => {
				const pendingId = createPendingId(payload.selectionRevision, index)
				pendingIdsRef.current.add(pendingId)
				return {
					type: "mention",
					attrs: { ...item, pending: true, pendingId },
				}
			})

			const inserted = activeEditor.commands.insertContentAt(
				{ from: insertPosition, to: insertPosition },
				pendingItems,
				{ updateSelection: false },
			)
			if (!inserted) {
				pendingIdsRef.current.clear()
				return
			}

			if (activeEditor.isFocused) promotePending()
		},
		[clearPending, promotePending],
	)

	useEffect(() => {
		const previousScope = scopeRef.current
		const scopeChanged =
			previousScope.workspaceId !== scope.workspaceId ||
			previousScope.projectId !== scope.projectId ||
			previousScope.topicId !== scope.topicId
		if (!enabled || scopeChanged) clearPending()
		scopeRef.current = scope
	}, [clearPending, enabled, scope])

	useEffect(() => {
		if (!enabled) return

		const handleSelectionMentions = (payload: SuperMagicCanvasSelectionMentionsPayload) => {
			if (!isCanvasSelectionMentionScopeInContext(payload.scopeKey, scopeRef.current)) return
			if (!payload.active && sourceScopeKeyRef.current !== payload.scopeKey) {
				return
			}
			replacePending(payload)
			sourceScopeKeyRef.current = payload.active ? payload.scopeKey : null
		}

		pubsub.subscribe(
			PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
			handleSelectionMentions,
		)
		return () =>
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				handleSelectionMentions,
			)
	}, [enabled, replacePending])

	return { clearPending, promotePending }
}

export const canvasPendingMentionBridgeTestUtils = {
	getDocumentEndPosition,
	getPendingInsertionRange,
	getValidSelectionRange,
	promotePendingMentionNodes,
	removePendingMentionNodes,
}
