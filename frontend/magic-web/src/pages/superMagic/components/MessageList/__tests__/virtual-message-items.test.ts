import { describe, expect, it } from "vitest"
import type { SuperMagicMessageItem } from "../type"
import {
	buildVirtualMessageProjection,
	composeVirtualMessageItems,
	findActiveStickyIndex,
	findNextStickyIndex,
	getPrependedVirtualItemCount,
	stabilizeVirtualMessageItems,
} from "../virtual-message-items"

function message(
	superMessageId: string,
	role: SuperMagicMessageItem["role"],
): SuperMagicMessageItem {
	return {
		super_message_id: superMessageId,
		app_message_id: `app-${superMessageId}`,
		role,
		content: `${role} message`,
	} as unknown as SuperMagicMessageItem
}

function toolMessageWithAttachment(superMessageId: string): SuperMagicMessageItem {
	return {
		...message(superMessageId, "tool"),
		attachments: [{ filename: "result.json" }],
	} as unknown as SuperMagicMessageItem
}

describe("virtual message projection", () => {
	it("keeps every converted message flat while retaining turn ownership", () => {
		const projection = buildVirtualMessageProjection([
			message("leading", "assistant"),
			message("user-1", "user"),
			message("assistant-1", "assistant"),
			toolMessageWithAttachment("tool-1"),
			message("user-2", "user"),
			message("assistant-2", "assistant"),
		])

		expect(projection.items.map((item) => item.key)).toEqual([
			"leading",
			"user-1",
			"assistant-1",
			"tool-1",
			"user-2",
			"assistant-2",
		])
		expect(projection.items.map((item) => item.turnKey)).toEqual([
			"leading-messages",
			"turn-user-1",
			"turn-user-1",
			"turn-user-1",
			"turn-user-2",
			"turn-user-2",
		])
		expect(projection.userIndices).toEqual([1, 4])
		expect(projection.messageKeys).toEqual([
			"leading",
			"user-1",
			"assistant-1",
			"tool-1",
			"user-2",
			"assistant-2",
		])
	})

	it("filters non-user messages whose explicit render payload is empty", () => {
		const emptyTool = {
			...message("empty-tool", "tool"),
			content: null,
			reasoning_content: null,
			tool_calls: null,
		} as unknown as SuperMagicMessageItem
		const visibleAssistant = {
			...message("assistant", "assistant"),
			content: "visible",
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([
			message("user", "user"),
			emptyTool,
			visibleAssistant,
		])

		expect(projection.items.map((item) => item.key)).toEqual(["user", "assistant"])
		expect(projection.items[1]?.index).toBe(1)
		expect(projection.items[1]?.sourceIndex).toBe(2)
	})

	it("filters a Tool whose only payload is text the renderer never shows", () => {
		// MessageNode renders AttachmentSection and nothing else for role=tool, so a text-only
		// result would otherwise be projected as a measured row that paints nothing.
		const textOnlyTool = {
			...message("text-only-tool", "tool"),
			content: "tool call succeeded",
			tool_calls: [{ id: "call-1" }],
			attachments: [],
			tool: { name: "read_files", status: "finished" },
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([
			message("user", "user"),
			message("assistant", "assistant"),
			textOnlyTool,
		])

		expect(projection.items.map((item) => item.key)).toEqual(["user", "assistant"])
	})

	it("keeps an attachment-free Tool when the previous message mentions file paths", () => {
		// AttachmentSection derives a file list from the preceding message's [@file_path:...]
		// mentions, so emptiness cannot be decided from the Tool row alone.
		const assistantWithMention = {
			...message("assistant-mention", "assistant"),
			content: "已生成 [@file_path:报告/结论.md]",
		} as unknown as SuperMagicMessageItem
		const attachmentFreeTool = {
			...message("tool-after-mention", "tool"),
			content: "ok",
			attachments: [],
			tool: { name: "write_file", status: "finished" },
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([assistantWithMention, attachmentFreeTool])

		expect(projection.items.map((item) => item.key)).toEqual([
			"assistant-mention",
			"tool-after-mention",
		])
	})

	it("keeps a Tool that renders through a typed node instead of MessageNode", () => {
		const typedTool = {
			...message("typed-tool", "tool"),
			type: "tool_call",
			attachments: [],
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([typedTool])

		expect(projection.items).toHaveLength(1)
	})

	it("keeps an empty-payload Tool when its business result carries attachments", () => {
		const finishTask = {
			...message("finish-task", "tool"),
			content: null,
			reasoning_content: null,
			tool_calls: null,
			attachments: [{ filename: "missing_animals.json" }],
			debug: {
				status: "running",
				tool: { name: "finish_task", status: "finished" },
			},
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([finishTask])

		expect(projection.items.map((item) => item.key)).toEqual(["finish-task"])
	})

	it("keeps a payload-free finish_task so the turn keeps its terminal status sidecar", () => {
		// A conversational turn ends with a finish_task that has neither content nor attachments.
		// Dropping it would take the task-completed badge and follow-up suggestions with it.
		const finishTask = {
			...message("bare-finish-task", "tool"),
			content: "",
			reasoning_content: null,
			tool_calls: null,
			attachments: [],
			tool: { name: "finish_task" },
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([finishTask])

		expect(projection.items.map((item) => item.key)).toEqual(["bare-finish-task"])
	})

	it("filters a terminal Tool response when it has no renderable result", () => {
		const emptyFinishedTool = {
			...message("empty-finished-tool", "tool"),
			content: null,
			reasoning_content: null,
			tool_calls: null,
			attachments: [],
			tool: { name: "read_files", status: "finished" },
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([emptyFinishedTool])

		expect(projection.items).toEqual([])
	})

	it("keeps a terminal empty-payload Assistant for Store-backed status sidecars", () => {
		const assistant = {
			...message("finished-assistant", "assistant"),
			content: null,
			reasoning_content: null,
			tool_calls: null,
			status: "finished",
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([assistant])

		expect(projection.items.map((item) => item.key)).toEqual(["finished-assistant"])
	})

	it("filters a non-user message with no payload or business sidecar", () => {
		const emptyAssistant = {
			...message("empty-assistant", "assistant"),
			content: undefined,
			reasoning_content: undefined,
			tool_calls: undefined,
		} as unknown as SuperMagicMessageItem

		const projection = buildVirtualMessageProjection([emptyAssistant])

		expect(projection.items).toEqual([])
	})

	it("counts only a strict prefix when the previous virtual sequence is preserved as a suffix", () => {
		expect(
			getPrependedVirtualItemCount(
				[{ key: "a" }, { key: "b" }],
				[{ key: "x" }, { key: "y" }, { key: "a" }, { key: "b" }],
			),
		).toBe(2)

		expect(
			getPrependedVirtualItemCount(
				[{ key: "a" }, { key: "b" }],
				[{ key: "a" }, { key: "b" }, { key: "c" }],
			),
		).toBe(0)

		expect(
			getPrependedVirtualItemCount(
				[{ key: "a" }, { key: "b" }],
				[{ key: "x" }, { key: "b" }],
			),
		).toBe(0)
	})

	it("allows concurrent tail appends while preserving the historical prepend count", () => {
		expect(
			getPrependedVirtualItemCount(
				[{ key: "a" }, { key: "b" }],
				[{ key: "x" }, { key: "a" }, { key: "b" }, { key: "new-tail" }],
			),
		).toBe(1)
	})

	it("does not count an empty previous sequence or a repeated history page", () => {
		expect(getPrependedVirtualItemCount([], [{ key: "x" }])).toBe(0)
		expect(
			getPrependedVirtualItemCount(
				[{ key: "a" }, { key: "b" }],
				[{ key: "a" }, { key: "b" }],
			),
		).toBe(0)
	})

	it("finds the latest User at or before the visible start", () => {
		expect(findActiveStickyIndex([2, 7, 11], 1)).toBeUndefined()
		expect(findActiveStickyIndex([2, 7, 11], 2)).toBe(2)
		expect(findActiveStickyIndex([2, 7, 11], 10)).toBe(7)
		expect(findActiveStickyIndex([2, 7, 11], 99)).toBe(11)
	})

	it("finds the User row that will take over the pinned slot", () => {
		expect(findNextStickyIndex([2, 7, 11], 2)).toBe(7)
		expect(findNextStickyIndex([2, 7, 11], 7)).toBe(11)
		expect(findNextStickyIndex([2, 7, 11], 11)).toBeUndefined()
		expect(findNextStickyIndex([], 0)).toBeUndefined()
	})

	it("composes revoked messages into the same flat list and limits only the collapsed preview", () => {
		const normal = buildVirtualMessageProjection([
			message("normal-user", "user"),
			message("normal-assistant", "assistant"),
		])
		const revoked = buildVirtualMessageProjection([
			message("revoked-user", "user"),
			message("revoked-assistant-1", "assistant"),
			message("revoked-assistant-2", "assistant"),
		])

		const collapsed = composeVirtualMessageItems({
			normalItems: normal.items,
			revokedItems: revoked.items,
			firstRevokedUserKey: "revoked-user",
			includeRevoked: true,
			revokedPreviewExpanded: false,
			collapsedPreviewLimit: 1,
		})

		expect(collapsed.items.map((item) => item.key)).toEqual([
			"normal-user",
			"normal-assistant",
			"revoked-user",
			"revoked-assistant-1",
		])
		expect(collapsed.items.map((item) => item.renderMode)).toEqual([
			"message",
			"message",
			"revoked-editable",
			"revoked-preview",
		])
		expect(collapsed.userIndices).toEqual([0, 2])
		expect(collapsed.items.slice(2).every((item) => !item.exportSelectable)).toBe(true)

		const expanded = composeVirtualMessageItems({
			normalItems: normal.items,
			revokedItems: revoked.items,
			firstRevokedUserKey: "revoked-user",
			includeRevoked: true,
			revokedPreviewExpanded: true,
			collapsedPreviewLimit: 1,
		})
		expect(expanded.items.map((item) => item.key)).toContain("revoked-assistant-2")
	})

	it("reuses normal item objects when composing repeatedly", () => {
		const normal = buildVirtualMessageProjection([
			message("normal-user", "user"),
			message("normal-assistant", "assistant"),
		])

		const first = composeVirtualMessageItems({
			normalItems: normal.items,
			revokedItems: [],
			includeRevoked: false,
			revokedPreviewExpanded: false,
			collapsedPreviewLimit: 1,
		})
		const second = composeVirtualMessageItems({
			normalItems: normal.items,
			revokedItems: [],
			includeRevoked: false,
			revokedPreviewExpanded: false,
			collapsedPreviewLimit: 1,
		})

		expect(second.items[0]).toBe(first.items[0])
		expect(second.items[1]).toBe(first.items[1])
	})

	it("keeps unaffected normal items stable when revoked preview visibility changes", () => {
		const normal = buildVirtualMessageProjection([
			message("normal-user", "user"),
			message("normal-assistant", "assistant"),
		])
		const revoked = buildVirtualMessageProjection([
			message("revoked-user", "user"),
			message("revoked-assistant-1", "assistant"),
			message("revoked-assistant-2", "assistant"),
		])

		const collapsed = composeVirtualMessageItems({
			normalItems: normal.items,
			revokedItems: revoked.items,
			firstRevokedUserKey: "revoked-user",
			includeRevoked: true,
			revokedPreviewExpanded: false,
			collapsedPreviewLimit: 1,
		})
		const expanded = composeVirtualMessageItems({
			normalItems: normal.items,
			revokedItems: revoked.items,
			firstRevokedUserKey: "revoked-user",
			includeRevoked: true,
			revokedPreviewExpanded: true,
			collapsedPreviewLimit: 1,
		})

		expect(expanded.items[0]).toBe(collapsed.items[0])
		expect(expanded.items[1]).toBe(collapsed.items[1])
	})

	it("reuses unchanged rows after a single message projection update", () => {
		const firstNode = message("first", "assistant")
		const secondNode = message("second", "assistant")
		const initial = buildVirtualMessageProjection([firstNode, secondNode])
		const updated = buildVirtualMessageProjection([
			firstNode,
			{ ...secondNode, content: "updated" },
		])

		const stable = stabilizeVirtualMessageItems(initial.items, updated.items)

		expect(stable[0]).toBe(initial.items[0])
		expect(stable[1]).toBe(updated.items[1])
	})
})
