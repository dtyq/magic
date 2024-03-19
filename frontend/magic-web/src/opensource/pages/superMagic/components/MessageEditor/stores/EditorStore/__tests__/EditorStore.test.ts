import { describe, it, expect, beforeEach, vi } from "vitest"
import { EditorStore } from "../index"
import { JSONContent, Editor } from "@tiptap/react"

describe("EditorStore", () => {
	let store: EditorStore

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
			const mockEditor = { commands: { focus: vi.fn() } } as unknown as Editor

			store.setEditor(mockEditor)
			expect(store.tiptapEditor).toBeTruthy()
			expect(store.tiptapEditor?.commands).toBeDefined()
		})

		it("should set editor to null", () => {
			const mockEditor = { commands: {} } as unknown as Editor
			store.setEditor(mockEditor)
			expect(store.tiptapEditor).toBeTruthy()

			store.setEditor(null)
			expect(store.tiptapEditor).toBeNull()
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
			const mockEditor = {
				commands: { clearContent: clearContentMock },
			} as unknown as Editor

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
			const mockEditor = {
				commands: { focus: focusMock },
			} as unknown as Editor

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
			const mockEditor = {
				commands: { setContent: setContentMock },
			} as unknown as Editor

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
			const mockEditor = {
				commands: { setContent: setContentMock },
			} as unknown as Editor

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
			const mockEditor = { commands: {} } as unknown as Editor
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
