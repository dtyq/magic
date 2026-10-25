import { act, renderHook } from "@testing-library/react"
import type { RefObject } from "react"
import { describe, expect, it, vi } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import type { MessageEditorMentionMatcher, MessageEditorRef } from "../../message/MessageEditor"
import { createReferenceResourcePanelItemFromPath } from "../../message/reference-assets/createReferenceResourcePanelItem"
import type { LinkedEditorMediaItem } from "../linkedEditorInputs"
import { useLinkedMediaMentionSelection } from "../useLinkedMediaMentionSelection"

function createMediaItem(overrides: Partial<LinkedEditorMediaItem> = {}): LinkedEditorMediaItem {
	return {
		connectionId: "connection-image",
		sourceElementId: "source-image",
		kind: "image",
		path: "./images/source.png",
		fileName: "source.png",
		status: "inactive",
		selected: false,
		...overrides,
	}
}

function createEditorRef(
	options: { insertResult?: boolean; removeResult?: boolean; replaceResult?: boolean } = {},
) {
	const insertMentionItem = vi.fn<MessageEditorRef["insertMentionItem"]>(
		() => options.insertResult ?? true,
	)
	const insertMentionItems = vi.fn<MessageEditorRef["insertMentionItems"]>(() => true)
	const removeMentionItems = vi.fn<MessageEditorRef["removeMentionItems"]>(
		() => options.removeResult ?? true,
	)
	const replaceMentionItems = vi.fn<MessageEditorRef["replaceMentionItems"]>(
		() => options.replaceResult ?? true,
	)
	const editorRef = {
		current: {
			focus: vi.fn(),
			getCurrentPrompt: vi.fn(() => ""),
			openMentionPanel: vi.fn(),
			insertMentionItem,
			insertMentionItems,
			removeMentionItems,
			replaceMentionItems,
		},
	} as RefObject<MessageEditorRef | null>

	return {
		editorRef,
		insertMentionItem,
		insertMentionItems,
		removeMentionItems,
		replaceMentionItems,
	}
}

const canSelectMediaConnection = vi.fn(() => true)
const resolveDesignAResourceReference = createTestResourceReferenceResolver()

describe("useLinkedMediaMentionSelection", () => {
	it("does not restore or clear any media selection by itself", () => {
		const mediaItem = createMediaItem({ selected: false })
		const { editorRef, insertMentionItems, removeMentionItems } = createEditorRef()
		const { result } = renderHook(() =>
			useLinkedMediaMentionSelection({
				mediaItems: [mediaItem],
				mentionedReferencePaths: [],
				canSelectMediaConnection,
				editorRef,
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		)

		act(() => result.current(mediaItem.connectionId, false))

		expect(insertMentionItems).not.toHaveBeenCalled()
		expect(removeMentionItems).not.toHaveBeenCalled()
	})

	it("inserts one mention after the linked candidate is accepted", () => {
		const mediaItem = createMediaItem()
		const { editorRef, insertMentionItem } = createEditorRef()
		const { result } = renderHook(() =>
			useLinkedMediaMentionSelection({
				mediaItems: [mediaItem],
				mentionedReferencePaths: [],
				canSelectMediaConnection,
				editorRef,
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		)

		let applied = false
		act(() => {
			applied = result.current(mediaItem.connectionId, true)
		})

		expect(applied).toBe(true)
		expect(canSelectMediaConnection).toHaveBeenCalledWith(mediaItem.connectionId)
		expect(insertMentionItem).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					file_name: "source.png",
					file_path: "./images/source.png",
				}),
			}),
			{ replaceSelection: false },
		)
	})

	it("does not produce a selection when mention insertion fails", () => {
		const mediaItem = createMediaItem()
		const { editorRef } = createEditorRef({ insertResult: false })
		const { result } = renderHook(() =>
			useLinkedMediaMentionSelection({
				mediaItems: [mediaItem],
				mentionedReferencePaths: [],
				canSelectMediaConnection,
				editorRef,
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		)

		let applied = true
		act(() => {
			applied = result.current(mediaItem.connectionId, true)
		})

		expect(applied).toBe(false)
		expect(mediaItem.selected).toBe(false)
	})

	it("does not duplicate an existing mention for the same canonical path", () => {
		const mediaItem = createMediaItem({ path: "/画布A/images/source.png" })
		const { editorRef, insertMentionItem } = createEditorRef()
		const { result } = renderHook(() =>
			useLinkedMediaMentionSelection({
				mediaItems: [mediaItem],
				mentionedReferencePaths: ["./images/source.png"],
				canSelectMediaConnection,
				editorRef,
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		)

		act(() => result.current(mediaItem.connectionId, true))

		expect(insertMentionItem).not.toHaveBeenCalled()
	})

	it("removes the matching mention and leaves selection derivation to the next snapshot", () => {
		const mediaItem = createMediaItem({ selected: true, status: "active" })
		const { editorRef, removeMentionItems } = createEditorRef()
		const { result } = renderHook(() =>
			useLinkedMediaMentionSelection({
				mediaItems: [mediaItem],
				mentionedReferencePaths: ["./images/source.png"],
				canSelectMediaConnection,
				editorRef,
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		)

		act(() => result.current(mediaItem.connectionId, false))

		expect(removeMentionItems).toHaveBeenCalledTimes(1)
		const matcher = removeMentionItems.mock.calls[0]?.[0] as
			| MessageEditorMentionMatcher
			| undefined
		expect(
			matcher?.(
				createReferenceResourcePanelItemFromPath("/画布A/images/source.png", "source.png"),
			),
		).toBe(true)
		expect(
			matcher?.(createReferenceResourcePanelItemFromPath("/images/other.png", "other.png")),
		).toBe(false)
	})

	it("keeps the editor and UI state unchanged when mention removal fails", () => {
		const mediaItem = createMediaItem({ selected: true, status: "active" })
		const { editorRef, removeMentionItems } = createEditorRef({ removeResult: false })
		const { result } = renderHook(() =>
			useLinkedMediaMentionSelection({
				mediaItems: [mediaItem],
				mentionedReferencePaths: ["./images/source.png"],
				canSelectMediaConnection,
				editorRef,
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		)

		let applied = true
		act(() => {
			applied = result.current(mediaItem.connectionId, false)
		})

		expect(applied).toBe(false)
		expect(removeMentionItems).toHaveBeenCalled()
		expect(mediaItem.selected).toBe(true)
	})

	it("does not remove a visible mention when its linked source disappears", () => {
		const mediaItem = createMediaItem({ selected: true, status: "active" })
		const { editorRef, insertMentionItem, replaceMentionItems } = createEditorRef()
		const { rerender } = renderHook(
			({ mediaItems }: { mediaItems: LinkedEditorMediaItem[] }) =>
				useLinkedMediaMentionSelection({
					mediaItems,
					mentionedReferencePaths: ["./images/source.png"],
					canSelectMediaConnection,
					editorRef,
					resolveResourceReference: resolveDesignAResourceReference,
				}),
			{ initialProps: { mediaItems: [mediaItem] } },
		)

		rerender({ mediaItems: [] })

		expect(insertMentionItem).not.toHaveBeenCalled()
		expect(replaceMentionItems).not.toHaveBeenCalled()
	})

	it("updates a tracked mention when the linked source path or name changes", () => {
		const oldItem = createMediaItem({
			path: "/画布A/images/source.png",
			selected: true,
			status: "active",
		})
		const { editorRef, replaceMentionItems } = createEditorRef()
		const { rerender } = renderHook(
			({
				mediaItem,
				mentionedPath,
			}: {
				mediaItem: LinkedEditorMediaItem
				mentionedPath: string
			}) =>
				useLinkedMediaMentionSelection({
					mediaItems: [mediaItem],
					mentionedReferencePaths: [mentionedPath],
					canSelectMediaConnection,
					editorRef,
					resolveResourceReference: resolveDesignAResourceReference,
				}),
			{ initialProps: { mediaItem: oldItem, mentionedPath: "./images/source.png" } },
		)

		rerender({
			mediaItem: createMediaItem({
				path: "./images/updated.png",
				fileName: "updated.png",
				selected: true,
				status: "active",
			}),
			mentionedPath: "./images/source.png",
		})

		expect(replaceMentionItems).toHaveBeenCalledTimes(1)
		const firstCall = replaceMentionItems.mock.calls[0] as
			| [
					MessageEditorMentionMatcher,
					ReturnType<typeof createReferenceResourcePanelItemFromPath>,
			  ]
			| undefined
		expect(
			firstCall?.[0]?.(
				createReferenceResourcePanelItemFromPath("/画布A/images/source.png", "source.png"),
			),
		).toBe(true)
		expect(firstCall?.[1]).toEqual(
			expect.objectContaining({
				data: expect.objectContaining({ file_name: "updated.png" }),
			}),
		)

		rerender({
			mediaItem: createMediaItem({
				path: "./images/updated.png",
				fileName: "renamed.png",
				selected: true,
				status: "active",
			}),
			mentionedPath: "./images/updated.png",
		})

		expect(replaceMentionItems).toHaveBeenCalledTimes(2)
		expect(replaceMentionItems.mock.calls[1]?.[1]).toEqual(
			expect.objectContaining({
				data: expect.objectContaining({ file_name: "renamed.png" }),
			}),
		)
	})
})
