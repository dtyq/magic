import { Node } from "@/infrastructure/editors/tiptap/core"
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import MessageEditor, {
	resolveMentionInsertionRange,
	type MessageEditorRef,
} from "../MessageEditor"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { createReferenceResourcePanelItemFromPath } from "../reference-assets/createReferenceResourcePanelItem"
import { createCanvasMentionPathMatcher } from "../../connection/linkedMediaMentionMatcher"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

const TestMentionExtension = Node.create({
	name: "mention",
	group: "inline",
	inline: true,
	atom: true,
	addAttributes() {
		return {
			type: { default: null },
			data: { default: null },
			pending: { default: false },
			pendingId: { default: null },
		}
	},
	parseHTML() {
		return [{ tag: "span[data-test-mention]" }]
	},
	renderHTML() {
		return ["span", { "data-test-mention": "" }]
	},
})

function expectCollapsedSelectionInside(editorDom: HTMLElement) {
	expect(document.activeElement).toBe(editorDom)
	const selection = window.getSelection()
	expect(selection?.isCollapsed).toBe(true)
	expect(selection?.anchorNode).not.toBeNull()
	expect(editorDom.contains(selection?.anchorNode ?? null)).toBe(true)
}

function expectCollapsedSelectionAtDocumentEnd(editorDom: HTMLElement) {
	expectCollapsedSelectionInside(editorDom)
	const selection = window.getSelection()
	const textNode = editorDom.querySelector("p")?.firstChild
	expect(textNode).toBeTruthy()
	expect(selection?.anchorNode).toBe(textNode)
	expect(selection?.anchorOffset).toBe(textNode?.textContent?.length ?? 0)
	expect(selection?.focusOffset).toBe(textNode?.textContent?.length ?? 0)
}

describe("MessageEditor mention synchronization", () => {
	it("does not report deleted mentions as preview hover targets", async () => {
		const onMentionItemHoverChange = vi.fn()
		const { container } = render(
			<MessageEditor
				value=""
				mentionExtension={TestMentionExtension}
				onMentionItemHoverChange={onMentionItemHoverChange}
			/>,
		)

		const editorDom = await waitFor(() => {
			const element = container.querySelector<HTMLElement>("[contenteditable='true']")
			expect(element).not.toBeNull()
			return element as HTMLElement
		})
		const deletedMention = document.createElement("span")
		deletedMention.className = "canvas-project-file-mention"
		deletedMention.dataset.filePath = "./images/deleted.png"
		deletedMention.dataset.deleted = "true"
		editorDom.append(deletedMention)

		fireEvent.pointerOver(deletedMention)

		expect(onMentionItemHoverChange).not.toHaveBeenCalled()
	})

	it("reports mentions that were already parsed during editor initialization", async () => {
		const onMentionChange = vi.fn()

		render(
			<MessageEditor
				value="@linked.png"
				matchableItems={[{ name: "linked.png", path: "./images/linked.png" }]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(onMentionChange).toHaveBeenCalledWith(
				["./images/linked.png"],
				"@linked.png",
				expect.objectContaining({ source: "sync", status: "ready" }),
			)
		})
	})

	it("keeps mention synchronization pending until external items are ready", async () => {
		const onMentionChange = vi.fn()
		const { rerender } = render(
			<MessageEditor
				value="@linked.png"
				matchableItems={[{ name: "linked.png", path: "./images/linked.png" }]}
				mentionExtension={TestMentionExtension}
				mentionItemsReady={false}
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(onMentionChange).toHaveBeenCalledWith(
				["./images/linked.png"],
				"@linked.png",
				expect.objectContaining({ source: "sync", status: "pending" }),
			)
		})
		expect(onMentionChange.mock.calls.some(([, , context]) => context.status === "ready")).toBe(
			false,
		)

		rerender(
			<MessageEditor
				value="@linked.png"
				matchableItems={[{ name: "linked.png", path: "./images/linked.png" }]}
				mentionExtension={TestMentionExtension}
				mentionItemsReady
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(onMentionChange).toHaveBeenCalledWith(
				["./images/linked.png"],
				"@linked.png",
				expect.objectContaining({ source: "sync", status: "ready" }),
			)
		})
	})

	it("does not emit duplicate ready snapshots when only matchable item identity changes", async () => {
		const onMentionChange = vi.fn()
		const { rerender } = render(
			<MessageEditor
				value="@linked.png"
				matchableItems={[{ name: "linked.png", path: "./images/linked.png" }]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(
				onMentionChange.mock.calls.filter(([, , context]) => context.status === "ready"),
			).toHaveLength(1)
		})

		rerender(
			<MessageEditor
				value="@linked.png"
				matchableItems={[{ name: "linked.png", path: "./images/linked.png" }]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(
			onMentionChange.mock.calls.filter(([, , context]) => context.status === "ready"),
		).toHaveLength(1)
	})

	it("preserves duplicate mention identities when same-name matchable items expand", async () => {
		const onMentionChange = vi.fn()
		const { rerender } = render(
			<MessageEditor
				value="@cat.png@cat.png"
				matchableItems={[{ name: "cat.png", path: "./images/cat.png" }]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(
				onMentionChange.mock.calls.some(
					([paths, , context]) =>
						context.status === "ready" &&
						paths.length === 1 &&
						paths[0] === "./images/cat.png",
				),
			).toBe(true)
		})

		rerender(
			<MessageEditor
				value="@cat.png@cat.png"
				matchableItems={[
					{ name: "cat.png", path: "./images/cat.png" },
					{ name: "cat.png", path: "/other/images/cat.png" },
				]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(
			onMentionChange.mock.calls.some(([paths]) => paths.includes("/other/images/cat.png")),
		).toBe(false)
	})

	it("keeps same-name distinct resources when parsing initial text", async () => {
		const onMentionChange = vi.fn()

		render(
			<MessageEditor
				value="@cat.png@cat.png"
				matchableItems={[
					{ name: "cat.png", path: "./images/cat.png" },
					{ name: "cat.png", path: "/other/images/cat.png" },
				]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(
				onMentionChange.mock.calls.some(
					([paths, , context]) =>
						context.status === "ready" &&
						paths[0] === "./images/cat.png" &&
						paths[1] === "/other/images/cat.png",
				),
			).toBe(true)
		})
	})

	it("restores repeated same-name mentions from structured path bindings", async () => {
		const onMentionChange = vi.fn()
		const editorRef = createRef<MessageEditorRef>()

		render(
			<MessageEditor
				ref={editorRef}
				value="@cat.png@cat.png"
				matchableItems={[
					{ name: "cat.png", path: "./images/cat.png" },
					{ name: "cat.png", path: "/other/images/cat.png" },
				]}
				mentionBindings={[
					{ fileName: "cat.png", path: "./images/cat.png" },
					{ fileName: "cat.png", path: "./images/cat.png" },
				]}
				mentionExtension={TestMentionExtension}
				onMentionChange={onMentionChange}
			/>,
		)

		await waitFor(() => {
			expect(editorRef.current?.getMentionBindings()).toEqual([
				{ fileName: "cat.png", path: "./images/cat.png" },
				{ fileName: "cat.png", path: "./images/cat.png" },
			])
			expect(
				onMentionChange.mock.calls.some(
					([paths, , context]) =>
						context.status === "ready" &&
						paths.length === 1 &&
						paths[0] === "./images/cat.png",
				),
			).toBe(true)
		})
	})

	it("restores a collapsed editor caret after imperative mention insertion and removal", async () => {
		const editorRef = createRef<MessageEditorRef>()

		const { container } = render(
			<MessageEditor ref={editorRef} value="" mentionExtension={TestMentionExtension} />,
		)

		await waitFor(() => expect(editorRef.current).not.toBeNull())
		const editorDom = container.querySelector<HTMLElement>("[contenteditable='true']")
		expect(editorDom).not.toBeNull()
		const outsideButton = document.createElement("button")
		document.body.append(outsideButton)
		vi.useFakeTimers()

		try {
			outsideButton.focus()
			act(() => {
				expect(
					editorRef.current?.insertMentionItem(
						createReferenceResourcePanelItemFromPath(
							"./images/source.png",
							"source.png",
						),
						{ replaceSelection: false },
					),
				).toBe(true)
			})
			expect(editorRef.current?.getCurrentPrompt()).toContain("@source.png")
			act(() => vi.runOnlyPendingTimers())
			expectCollapsedSelectionInside(editorDom as HTMLElement)

			outsideButton.focus()
			act(() => {
				expect(
					editorRef.current?.removeMentionItems(
						createCanvasMentionPathMatcher(
							"/画布A/images/source.png",
							resolveDesignAResourceReference,
						),
					),
				).toBe(true)
			})
			expect(editorRef.current?.getCurrentPrompt()).not.toContain("@source.png")
			act(() => vi.runOnlyPendingTimers())
			expectCollapsedSelectionInside(editorDom as HTMLElement)
		} finally {
			vi.clearAllTimers()
			vi.useRealTimers()
			outsideButton.remove()
		}
	})

	it("does not add lines after repeated select-style insert and remove cycles", async () => {
		const editorRef = createRef<MessageEditorRef>()

		render(<MessageEditor ref={editorRef} value="" mentionExtension={TestMentionExtension} />)
		await waitFor(() => expect(editorRef.current).not.toBeNull())
		vi.useFakeTimers()

		try {
			for (let cycle = 0; cycle < 3; cycle += 1) {
				act(() => {
					expect(
						editorRef.current?.insertMentionItem(
							createReferenceResourcePanelItemFromPath(
								"./images/source.png",
								"source.png",
							),
							{ replaceSelection: false },
						),
					).toBe(true)
				})
				expect(editorRef.current?.getCurrentPrompt()).toBe("@source.png")

				act(() => {
					expect(
						editorRef.current?.removeMentionItems(
							createCanvasMentionPathMatcher("./images/source.png"),
						),
					).toBe(true)
				})
				expect(editorRef.current?.getCurrentPrompt()).toBe("")
				vi.clearAllTimers()
			}
		} finally {
			vi.clearAllTimers()
			vi.useRealTimers()
		}
	})

	it("inserts ordered clipboard parts at the captured selection", async () => {
		const editorRef = createRef<MessageEditorRef>()

		render(
			<MessageEditor ref={editorRef} value="abcd" mentionExtension={TestMentionExtension} />,
		)
		await waitFor(() => expect(editorRef.current).not.toBeNull())

		act(() => {
			expect(
				editorRef.current?.insertClipboardParts([{ type: "text", text: "X" }], {
					selection: { from: 2, to: 4 },
				}),
			).toBe(true)
		})

		expect(editorRef.current?.getCurrentPrompt()).toBe("aXd")
	})

	it("inserts ordered text and pending clipboard parts without syncing prompt yet", async () => {
		const editorRef = createRef<MessageEditorRef>()
		const onChange = vi.fn()

		render(
			<MessageEditor
				ref={editorRef}
				value=""
				mentionExtension={TestMentionExtension}
				onChange={onChange}
			/>,
		)
		await waitFor(() => expect(editorRef.current).not.toBeNull())

		act(() => {
			expect(
				editorRef.current?.insertClipboardParts([
					{ type: "text", text: "see " },
					{
						type: "pending",
						item: {
							pendingId: "clip-1",
							fileName: "clip.png",
							status: "init",
							progress: 0,
						},
					},
				]),
			).toBe(true)
		})

		expect(editorRef.current?.getCurrentPrompt()).toBe("see ")
		expect(editorRef.current?.getPendingUploadMentions()).toEqual([
			expect.objectContaining({ pendingId: "clip-1", fileName: "clip.png" }),
		])
		expect(onChange).not.toHaveBeenCalledWith("@clip.png")
	})

	it("keeps pending uploads out of prompt sync until they resolve", async () => {
		const editorRef = createRef<MessageEditorRef>()
		const onChange = vi.fn()
		const onMentionChange = vi.fn()

		render(
			<MessageEditor
				ref={editorRef}
				value=""
				mentionExtension={TestMentionExtension}
				onChange={onChange}
				onMentionChange={onMentionChange}
			/>,
		)
		await waitFor(() => expect(editorRef.current).not.toBeNull())

		act(() => {
			expect(
				editorRef.current?.insertPendingUploadMentions([
					{
						pendingId: "upload-1",
						fileName: "pending.png",
						status: "uploading",
						progress: 25,
					},
				]),
			).toBe(true)
		})
		expect(editorRef.current?.getCurrentPrompt()).toBe("")
		expect(editorRef.current?.getPendingUploadMentions()).toEqual([
			expect.objectContaining({ pendingId: "upload-1", progress: 25, status: "uploading" }),
		])
		expect(onChange).not.toHaveBeenCalledWith("@pending.png")

		act(() => {
			expect(
				editorRef.current?.resolvePendingUploadMention(
					"upload-1",
					createReferenceResourcePanelItemFromPath("./images/pending.png", "pending.png"),
				),
			).toBe(true)
		})
		expect(editorRef.current?.getPendingUploadMentions()).toEqual([])
		expect(editorRef.current?.getCurrentPrompt()).toBe("@pending.png")
		expect(onChange).toHaveBeenCalledWith("@pending.png")
	})

	it("updates, fails, and removes pending uploads by pendingId", async () => {
		const editorRef = createRef<MessageEditorRef>()
		render(<MessageEditor ref={editorRef} value="" mentionExtension={TestMentionExtension} />)
		await waitFor(() => expect(editorRef.current).not.toBeNull())

		act(() => {
			expect(
				editorRef.current?.insertPendingUploadMentions([
					{ pendingId: "upload-2", fileName: "failed.png" },
					{ pendingId: "upload-3", fileName: "removed.png" },
				]),
			).toBe(true)
		})
		act(() => {
			expect(
				editorRef.current?.updatePendingUploadMention("upload-2", { progress: 80 }),
			).toBe(true)
			expect(editorRef.current?.failPendingUploadMention("upload-2", "上传失败")).toBe(true)
		})
		expect(editorRef.current?.getPendingUploadMentions()).toEqual([
			expect.objectContaining({
				pendingId: "upload-2",
				progress: 80,
				status: "error",
				error: "上传失败",
			}),
			expect.objectContaining({ pendingId: "upload-3" }),
		])
		act(() => {
			expect(editorRef.current?.removePendingUploadMention("upload-3")).toBe(true)
		})
		expect(editorRef.current?.getPendingUploadMentions()).toEqual([
			expect.objectContaining({ pendingId: "upload-2" }),
		])
	})

	it("replaces mentions through an equivalent canvas resource path", async () => {
		const editorRef = createRef<MessageEditorRef>()

		const { container } = render(
			<MessageEditor ref={editorRef} value="" mentionExtension={TestMentionExtension} />,
		)
		await waitFor(() => expect(editorRef.current).not.toBeNull())
		const editorDom = container.querySelector<HTMLElement>("[contenteditable='true']")
		expect(editorDom).not.toBeNull()
		const outsideButton = document.createElement("button")
		document.body.append(outsideButton)
		vi.useFakeTimers()

		try {
			act(() => {
				editorRef.current?.insertMentionItem(
					createReferenceResourcePanelItemFromPath("./images/source.png", "source.png"),
				)
			})
			act(() => {
				expect(
					editorRef.current?.replaceMentionItems(
						createCanvasMentionPathMatcher(
							"/画布A/images/source.png",
							resolveDesignAResourceReference,
						),
						createReferenceResourcePanelItemFromPath(
							"./images/updated.png",
							"updated.png",
						),
					),
				).toBe(true)
			})

			expect(editorRef.current?.getCurrentPrompt()).toBe("@updated.png")
			outsideButton.focus()
			act(() => vi.runOnlyPendingTimers())
			expectCollapsedSelectionInside(editorDom as HTMLElement)
		} finally {
			vi.clearAllTimers()
			vi.useRealTimers()
			outsideButton.remove()
		}
	})

	it("keeps the caret at document end after setContent while autoFocusAtDocumentEnd is pinning", async () => {
		const rect = {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			toJSON() {
				return this
			},
		} as DOMRect
		const previousGetBoundingClientRect = Range.prototype.getBoundingClientRect
		const previousGetClientRects = Range.prototype.getClientRects
		const previousTextGetClientRects = Object.getOwnPropertyDescriptor(
			CharacterData.prototype,
			"getClientRects",
		)
		const previousTextGetBoundingClientRect = Object.getOwnPropertyDescriptor(
			CharacterData.prototype,
			"getBoundingClientRect",
		)
		Range.prototype.getBoundingClientRect = () => rect
		Range.prototype.getClientRects = () =>
			({
				length: 0,
				item: () => null,
				*[Symbol.iterator]() {},
			}) as DOMRectList
		Object.defineProperty(CharacterData.prototype, "getClientRects", {
			configurable: true,
			value: () =>
				({
					length: 0,
					item: () => null,
					*[Symbol.iterator]() {},
				}) as DOMRectList,
		})
		Object.defineProperty(CharacterData.prototype, "getBoundingClientRect", {
			configurable: true,
			value: () => rect,
		})

		try {
			const { container, rerender } = render(
				<MessageEditor
					value="hello"
					autoFocus
					autoFocusAtDocumentEnd
					mentionExtension={TestMentionExtension}
				/>,
			)

			const editorDom = await waitFor(() => {
				const element = container.querySelector<HTMLElement>("[contenteditable='true']")
				expect(element).not.toBeNull()
				return element as HTMLElement
			})

			await waitFor(() => {
				expect(document.activeElement).toBe(editorDom)
				expect(editorDom.textContent).toContain("hello")
				expectCollapsedSelectionAtDocumentEnd(editorDom)
			})

			rerender(
				<MessageEditor
					value="hello world"
					autoFocus
					autoFocusAtDocumentEnd
					mentionExtension={TestMentionExtension}
				/>,
			)

			await waitFor(() => {
				expect(editorDom.textContent).toContain("hello world")
				expect(document.activeElement).toBe(editorDom)
				expectCollapsedSelectionAtDocumentEnd(editorDom)
			})
		} finally {
			Range.prototype.getBoundingClientRect = previousGetBoundingClientRect
			Range.prototype.getClientRects = previousGetClientRects
			if (previousTextGetClientRects) {
				Object.defineProperty(
					CharacterData.prototype,
					"getClientRects",
					previousTextGetClientRects,
				)
			} else {
				Reflect.deleteProperty(CharacterData.prototype, "getClientRects")
			}
			if (previousTextGetBoundingClientRect) {
				Object.defineProperty(
					CharacterData.prototype,
					"getBoundingClientRect",
					previousTextGetBoundingClientRect,
				)
			} else {
				Reflect.deleteProperty(CharacterData.prototype, "getBoundingClientRect")
			}
		}
	})
})

describe("resolveMentionInsertionRange", () => {
	it("moves a stale document-end position back inside the final text block", () => {
		expect(
			resolveMentionInsertionRange({
				currentSelection: { from: 2, to: 2 },
				maxPos: 2,
				replaceSelection: false,
			}),
		).toEqual({ from: 1, to: 1 })
	})

	it("collapses a preserved text selection to its end when insertion must not replace text", () => {
		expect(
			resolveMentionInsertionRange({
				currentSelection: { from: 2, to: 4 },
				preservedSelection: { from: 6, to: 9 },
				maxPos: 12,
				replaceSelection: false,
			}),
		).toEqual({ from: 9, to: 9 })
	})

	it("keeps the selected range when replacement is enabled", () => {
		expect(
			resolveMentionInsertionRange({
				currentSelection: { from: 2, to: 4 },
				preservedSelection: { from: 6, to: 9 },
				maxPos: 12,
				replaceSelection: true,
			}),
		).toEqual({ from: 6, to: 9 })
	})
})
