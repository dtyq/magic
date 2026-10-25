import { describe, it, expect, beforeEach, vi } from "vitest"
import { EditorStore } from "../index"
import { JSONContent, Editor } from "@/infrastructure/editors/tiptap/react"
import { MentionItemType } from "@/components/business/MentionPanel/types"

describe("EditorStore", () => {
	let store: EditorStore

	/** Creates an editor-shaped mock accepted by the lifecycle guard. */
	function createActiveEditor(commands: Record<string, ReturnType<typeof vi.fn>> = {}) {
		return {
			isDestroyed: false,
			commands: {
				insertContent: vi.fn(),
				focus: vi.fn(),
				...commands,
			},
		} as unknown as Editor
	}

	beforeEach(() => {
		store = new EditorStore()
	})

	describe("initialization", () => {
		it("should initialize with default values", () => {
			expect(store.value).toBeUndefined()
			expect(store.tiptapEditor).toBeNull()
			expect(store.isComposing).toBe(false)
			expect(store.isOAuthInProgress).toBe(false)
			expect(store.placeholder).toBe("")
		})
	})

	describe("isEmpty computed", () => {
		it("should return true when value is undefined", () => {
			store.value = undefined
			expect(store.isEmpty).toBe(true)
		})

		it("should return true when content array is empty", () => {
			store.value = { type: "doc", content: [] }
			expect(store.isEmpty).toBe(true)
		})

		it("should return true when content only has empty paragraphs", () => {
			store.value = {
				type: "doc",
				content: [
					{ type: "paragraph", content: [] },
					{ type: "paragraph", content: [] },
				],
			}
			expect(store.isEmpty).toBe(true)
		})

		it("should return false when content has text", () => {
			store.value = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello" }],
					},
				],
			}
			expect(store.isEmpty).toBe(false)
		})

		it("should return false when content has non-paragraph nodes", () => {
			store.value = {
				type: "doc",
				content: [{ type: "mention", attrs: { type: "file", data: {} } }],
			}
			expect(store.isEmpty).toBe(false)
		})
	})

	describe("setValue", () => {
		it("should set value correctly", () => {
			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "Test" }] }],
			}

			store.setValue(content)
			expect(store.value).toEqual(content)
		})

		it("should set value to undefined", () => {
			store.setValue({ type: "doc", content: [] })
			expect(store.value).toBeDefined()

			store.setValue(undefined)
			expect(store.value).toBeUndefined()
		})
	})

	describe("setEditor", () => {
		it("should set editor instance", () => {
			const mockEditor = createActiveEditor()

			store.setEditor(mockEditor)
			expect(store.tiptapEditor).toBeTruthy()
			expect(store.tiptapEditor?.commands).toBeDefined()
		})

		it("should set editor to null", () => {
			const mockEditor = createActiveEditor()
			store.setEditor(mockEditor)
			expect(store.tiptapEditor).toBeTruthy()

			store.setEditor(null)
			expect(store.tiptapEditor).toBeNull()
		})

		it("replays buffered content when the editor becomes available", () => {
			const setContent = vi.fn()
			const mockEditor = createActiveEditor({ setContent })
			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "Mock" }] }],
			}
			store.setValue(content)

			store.setEditor(mockEditor)

			expect(setContent).toHaveBeenCalledWith(content, { emitUpdate: false })
		})
	})

	describe("trusted Mention restoration", () => {
		/** Creates trusted SDK content with a stable mock Mention identity. */
		function createTrustedMentionContent(id = "mock-skill-001"): JSONContent {
			return {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "mention",
								attrs: {
									type: MentionItemType.SKILL,
									data: { id, name: "Mock Skill" },
								},
							},
						],
					},
				],
			}
		}

		it("keeps the validation bypass active during the restore transaction", async () => {
			const setContent = vi.fn()
			const mockEditor = createActiveEditor({ setContent })
			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "mock" }] }],
			}

			store.setEditor(mockEditor)
			store.updateContent(content, { preserveMentionValidation: true })

			expect(setContent).toHaveBeenCalledWith(content)
			expect(store.preserveMentionValidation).toBe(true)
			expect(store.preserveMentionContent).toBe(true)
			await Promise.resolve()
			expect(store.preserveMentionValidation).toBe(false)
		})

		it("retains trusted Mention identities after the synchronous bypass ends", async () => {
			store.updateContent(createTrustedMentionContent(), {
				preserveMentionValidation: true,
			})

			await Promise.resolve()

			expect(
				store.isTrustedMention({
					type: MentionItemType.SKILL,
					data: { id: "mock-skill-001", name: "Mock Skill" },
				}),
			).toBe(true)
		})

		it("replaces trusted Mention identities on the next trusted restore", () => {
			store.updateContent(createTrustedMentionContent("mock-skill-001"), {
				preserveMentionValidation: true,
			})
			store.updateContent(createTrustedMentionContent("mock-skill-002"), {
				preserveMentionValidation: true,
			})

			expect(
				store.isTrustedMention({
					type: MentionItemType.SKILL,
					data: { id: "mock-skill-001" },
				}),
			).toBe(false)
			expect(
				store.isTrustedMention({
					type: MentionItemType.SKILL,
					data: { id: "mock-skill-002" },
				}),
			).toBe(true)
		})

		it("clears trusted Mention identities for ordinary content updates", () => {
			store.updateContent(createTrustedMentionContent(), {
				preserveMentionValidation: true,
			})

			store.updateContent({ type: "doc", content: [{ type: "paragraph" }] })

			expect(
				store.isTrustedMention({
					type: MentionItemType.SKILL,
					data: { id: "mock-skill-001" },
				}),
			).toBe(false)
		})

		it("clears trusted Mention identities when the editor is cleared", () => {
			store.updateContent(createTrustedMentionContent(), {
				preserveMentionValidation: true,
			})

			store.clearContent()

			expect(
				store.isTrustedMention({
					type: MentionItemType.SKILL,
					data: { id: "mock-skill-001" },
				}),
			).toBe(false)
		})
	})

	describe("setPlaceholder", () => {
		it("should set placeholder text", () => {
			store.setPlaceholder("Enter message...")
			expect(store.placeholder).toBe("Enter message...")
		})

		it("should update placeholder text", () => {
			store.setPlaceholder("Old placeholder")
			store.setPlaceholder("New placeholder")
			expect(store.placeholder).toBe("New placeholder")
		})
	})

	describe("clearContent", () => {
		it("should clear value", () => {
			store.value = { type: "doc", content: [{ type: "paragraph" }] }
			store.clearContent()
			expect(store.value).toBeUndefined()
		})

		it("should call editor clearContent command when editor exists", () => {
			const clearContentMock = vi.fn()
			const mockEditor = createActiveEditor({ clearContent: clearContentMock })

			store.setEditor(mockEditor)
			store.clearContent()

			expect(clearContentMock).toHaveBeenCalledTimes(1)
		})

		it("should not throw when editor is null", () => {
			store.setEditor(null)
			expect(() => store.clearContent()).not.toThrow()
		})
	})

	describe("focus", () => {
		it("should call editor focus command when editor exists", () => {
			const focusMock = vi.fn()
			const mockEditor = createActiveEditor({ focus: focusMock })

			store.setEditor(mockEditor)
			store.focus()

			expect(focusMock).toHaveBeenCalledTimes(1)
		})

		it("should not throw when editor is null", () => {
			store.setEditor(null)
			expect(() => store.focus()).not.toThrow()
		})
	})

	describe("updateContent", () => {
		it("should update value", () => {
			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
			}

			store.updateContent(content)
			expect(store.value).toEqual(content)
		})

		it("should call editor setContent when editor exists", () => {
			const setContentMock = vi.fn()
			const mockEditor = createActiveEditor({ setContent: setContentMock })

			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph" }],
			}

			store.setEditor(mockEditor)
			store.updateContent(content)

			expect(setContentMock).toHaveBeenCalledWith(content)
		})

		it("should not call editor setContent when content is undefined", () => {
			const setContentMock = vi.fn()
			const mockEditor = createActiveEditor({ setContent: setContentMock })

			store.setEditor(mockEditor)
			store.updateContent(undefined)

			expect(setContentMock).not.toHaveBeenCalled()
			expect(store.value).toBeUndefined()
		})

		it("should not call editor setContent when editor is null", () => {
			const content: JSONContent = { type: "doc", content: [] }

			store.setEditor(null)
			expect(() => store.updateContent(content)).not.toThrow()
			expect(store.value).toEqual(content)
		})
	})

	describe("composition handling", () => {
		it("should set isComposing to true on composition start", () => {
			expect(store.isComposing).toBe(false)

			store.handleCompositionStart()
			expect(store.isComposing).toBe(true)
		})

		it("should set isComposing to false on composition end", () => {
			store.handleCompositionStart()
			expect(store.isComposing).toBe(true)

			store.handleCompositionEnd()
			expect(store.isComposing).toBe(false)
		})

		it("should handle multiple composition cycles", () => {
			store.handleCompositionStart()
			expect(store.isComposing).toBe(true)

			store.handleCompositionEnd()
			expect(store.isComposing).toBe(false)

			store.handleCompositionStart()
			expect(store.isComposing).toBe(true)

			store.handleCompositionEnd()
			expect(store.isComposing).toBe(false)
		})
	})

	describe("OAuth state", () => {
		it("should set OAuth in progress state", () => {
			expect(store.isOAuthInProgress).toBe(false)

			store.setOAuthInProgress(true)
			expect(store.isOAuthInProgress).toBe(true)

			store.setOAuthInProgress(false)
			expect(store.isOAuthInProgress).toBe(false)
		})
	})

	describe("dispose", () => {
		it("should clear editor reference", () => {
			const mockEditor = createActiveEditor()
			store.setEditor(mockEditor)
			expect(store.tiptapEditor).toBeTruthy()

			store.dispose()
			expect(store.tiptapEditor).toBeNull()
		})

		it("should not throw when editor is already null", () => {
			store.setEditor(null)
			expect(() => store.dispose()).not.toThrow()
			expect(store.tiptapEditor).toBeNull()
		})
	})

	describe("MobX reactivity", () => {
		it("should make value observable", () => {
			const content: JSONContent = { type: "doc", content: [] }
			store.setValue(content)
			expect(store.value).toEqual(content)
		})

		it("should make isEmpty computed observable", () => {
			expect(store.isEmpty).toBe(true)

			store.setValue({
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "test" }] }],
			})

			expect(store.isEmpty).toBe(false)
		})
	})
})
