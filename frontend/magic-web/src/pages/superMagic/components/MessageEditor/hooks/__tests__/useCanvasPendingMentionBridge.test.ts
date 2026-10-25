import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { createCanvasSelectionMentionScopeKey } from "@/pages/superMagic/events/message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	canvasPendingMentionBridgeTestUtils,
	useCanvasPendingMentionBridge,
} from "../useCanvasPendingMentionBridge"

function createEditorWithMentions(
	mentions: Array<{ pending?: boolean; pendingId?: string }>,
): Editor {
	const transaction = {
		delete: vi.fn().mockReturnThis(),
		setNodeMarkup: vi.fn().mockReturnThis(),
	}
	const doc = {
		content: { size: 8 },
		descendants: (callback: (node: unknown, pos: number) => boolean) => {
			mentions.forEach((mention, index) => {
				callback(
					{
						type: { name: "mention" },
						nodeSize: 1,
						attrs: {
							type: MentionItemType.PROJECT_FILE,
							data: { file_id: `file-${index}`, file_name: `file-${index}.png` },
							...mention,
						},
					},
					index + 1,
				)
			})
		},
	}

	return {
		isFocused: false,
		state: { doc, selection: { from: 1, to: 1 }, tr: transaction },
		view: { dispatch: vi.fn() },
	} as unknown as Editor
}

function createInteractiveEditor() {
	type MentionAttrs = {
		type: MentionItemType
		data: { file_id: string; file_name: string }
		pending?: boolean
		pendingId?: string
	}
	const mentions: MentionAttrs[] = []
	const listeners = new Map<string, Set<() => void>>()

	const doc = {
		content: {
			get size() {
				return mentions.length + 2
			},
		},
		descendants: (callback: (node: unknown, pos: number) => boolean) => {
			mentions.forEach((attrs, index) => {
				callback({ type: { name: "mention" }, nodeSize: 1, attrs }, index + 1)
			})
		},
	}

	const editor = {
		isDestroyed: false,
		isFocused: false,
		state: {
			doc,
			selection: { from: 1, to: 1 },
			get tr() {
				const deletes: Array<{ from: number; to: number }> = []
				const updates: Array<{ pos: number; attrs: MentionAttrs }> = []
				return {
					deletes,
					updates,
					delete(from: number, to: number) {
						deletes.push({ from, to })
						return this
					},
					setNodeMarkup(pos: number, _type: unknown, attrs: MentionAttrs) {
						updates.push({ pos, attrs })
						return this
					},
				}
			},
		},
		view: {
			dispatch: vi.fn(
				(transaction: {
					deletes: Array<{ from: number; to: number }>
					updates: Array<{ pos: number; attrs: MentionAttrs }>
				}) => {
					transaction.updates.forEach(({ pos, attrs }) => {
						mentions[pos - 1] = attrs
					})
					transaction.deletes
						.sort((left, right) => right.from - left.from)
						.forEach(({ from }) => mentions.splice(from - 1, 1))
				},
			),
		},
		commands: {
			insertContentAt: vi.fn(
				(_range: unknown, items: Array<{ type: "mention"; attrs: MentionAttrs }>) => {
					mentions.push(...items.map((item) => item.attrs))
					return true
				},
			),
		},
		on: vi.fn((event: string, callback: () => void) => {
			const callbacks = listeners.get(event) ?? new Set()
			callbacks.add(callback)
			listeners.set(event, callbacks)
		}),
		off: vi.fn((event: string, callback: () => void) => {
			listeners.get(event)?.delete(callback)
		}),
	} as unknown as Editor

	return { editor, mentions }
}

function createPayload(scopeKey: string, fileId: string, active = true) {
	return {
		scopeKey,
		selectionRevision: fileId,
		active,
		items: active
			? [
					{
						type: MentionItemType.PROJECT_FILE,
						data: { file_id: fileId, file_name: `${fileId}.png` },
					},
				]
			: [],
	}
}

describe("canvas pending mention bridge", () => {
	it("promotes pending mentions in place by removing only pending attributes", () => {
		const editor = createEditorWithMentions([
			{ pending: true, pendingId: "canvas-selection:1" },
			{},
		])

		const count = canvasPendingMentionBridgeTestUtils.promotePendingMentionNodes(
			editor,
			new Set(["canvas-selection:1"]),
		)

		expect(count).toBe(1)
		expect(editor.state.tr.setNodeMarkup).toHaveBeenCalledWith(
			1,
			undefined,
			expect.objectContaining({
				type: MentionItemType.PROJECT_FILE,
				data: { file_id: "file-0", file_name: "file-0.png" },
			}),
		)
		expect(editor.state.tr.setNodeMarkup).not.toHaveBeenCalledWith(
			1,
			undefined,
			expect.objectContaining({ pending: true }),
		)
		expect(editor.view.dispatch).toHaveBeenCalledWith(editor.state.tr)
	})

	it("promotes only bridge-owned pending mentions", () => {
		const editor = createEditorWithMentions([
			{ pending: true, pendingId: "canvas-selection:owned" },
			{ pending: true, pendingId: "canvas-selection:other" },
		])

		const count = canvasPendingMentionBridgeTestUtils.promotePendingMentionNodes(
			editor,
			new Set(["canvas-selection:owned"]),
		)

		expect(count).toBe(1)
		expect(editor.state.tr.setNodeMarkup).toHaveBeenCalledTimes(1)
		expect(editor.state.tr.setNodeMarkup).toHaveBeenCalledWith(
			1,
			undefined,
			expect.not.objectContaining({ pending: true }),
		)
	})

	it("removes only bridge-owned pending nodes when replacing a selection", () => {
		const editor = createEditorWithMentions([
			{ pending: true, pendingId: "canvas-selection:owned" },
			{ pending: true, pendingId: "canvas-selection:other" },
		])

		const count = canvasPendingMentionBridgeTestUtils.removePendingMentionNodes(
			editor,
			new Set(["canvas-selection:owned"]),
		)

		expect(count).toBe(1)
		expect(editor.state.tr.delete).toHaveBeenCalledWith(1, 2)
		expect(editor.view.dispatch).toHaveBeenCalledWith(editor.state.tr)
	})

	it("appends when an unfocused editor has no remembered user selection", () => {
		const editor = createEditorWithMentions([])

		expect(canvasPendingMentionBridgeTestUtils.getPendingInsertionRange(editor, null)).toEqual({
			from: 7,
			to: 7,
		})
	})

	it("uses the remembered cursor when the editor is unfocused", () => {
		const editor = createEditorWithMentions([])

		expect(
			canvasPendingMentionBridgeTestUtils.getPendingInsertionRange(editor, {
				from: 3,
				to: 3,
			}),
		).toEqual({ from: 3, to: 3 })
	})

	it("ignores mismatched conversations and promotes owned nodes in place", () => {
		const { editor, mentions } = createInteractiveEditor()
		const currentScope = {
			workspaceId: "workspace-1",
			projectId: "project-1",
			topicId: "topic-1",
		}
		const { result, unmount } = renderHook(() =>
			useCanvasPendingMentionBridge({ editor, enabled: true, scope: currentScope }),
		)

		act(() => {
			pubsub.publish(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				createPayload(
					createCanvasSelectionMentionScopeKey({
						...currentScope,
						topicId: "other-topic",
						designProjectId: "canvas-other",
					}),
					"ignored",
				),
			)
		})
		expect(mentions).toHaveLength(0)

		act(() => {
			pubsub.publish(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				createPayload(
					createCanvasSelectionMentionScopeKey({
						...currentScope,
						designProjectId: "canvas-1",
					}),
					"file-1",
				),
			)
		})
		expect(mentions[0]).toMatchObject({ pending: true, data: { file_id: "file-1" } })

		act(() => result.current.promotePending())
		expect(mentions[0]).toEqual({
			type: MentionItemType.PROJECT_FILE,
			data: { file_id: "file-1", file_name: "file-1.png" },
		})
		unmount()
	})

	it("ignores an inactive snapshot from a different cached Canvas tab", () => {
		const { editor, mentions } = createInteractiveEditor()
		const scope = { workspaceId: "workspace-1", projectId: "project-1", topicId: "topic-1" }
		const canvasOneScope = createCanvasSelectionMentionScopeKey({
			...scope,
			designProjectId: "canvas-1",
		})
		const canvasTwoScope = createCanvasSelectionMentionScopeKey({
			...scope,
			designProjectId: "canvas-2",
		})
		const { unmount } = renderHook(() =>
			useCanvasPendingMentionBridge({ editor, enabled: true, scope }),
		)

		act(() => {
			pubsub.publish(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				createPayload(canvasTwoScope, "file-2"),
			)
			pubsub.publish(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				createPayload(canvasOneScope, "inactive", false),
			)
		})
		expect(mentions).toHaveLength(1)
		expect(mentions[0].data.file_id).toBe("file-2")

		act(() => {
			pubsub.publish(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				createPayload(canvasTwoScope, "inactive", false),
			)
		})
		expect(mentions).toHaveLength(0)
		unmount()
	})

	it("allows an active Canvas with no media to clear the previous source", () => {
		const { editor, mentions } = createInteractiveEditor()
		const scope = { workspaceId: "workspace-1", projectId: "project-1", topicId: "topic-1" }
		const canvasOneScope = createCanvasSelectionMentionScopeKey({
			...scope,
			designProjectId: "canvas-1",
		})
		const canvasTwoScope = createCanvasSelectionMentionScopeKey({
			...scope,
			designProjectId: "canvas-2",
		})
		const { unmount } = renderHook(() =>
			useCanvasPendingMentionBridge({ editor, enabled: true, scope }),
		)

		act(() => {
			pubsub.publish(
				PubSubEvents.Super_Magic_Canvas_Selection_Mentions,
				createPayload(canvasOneScope, "file-1"),
			)
			pubsub.publish(PubSubEvents.Super_Magic_Canvas_Selection_Mentions, {
				scopeKey: canvasTwoScope,
				selectionRevision: "empty",
				active: true,
				items: [],
			})
		})

		expect(mentions).toHaveLength(0)
		unmount()
	})
})
