import { describe, it, expect, beforeEach } from "vitest"
import { MessageEditorStore } from "../MessageEditorStore"

describe("MessageEditorStore Integration", () => {
	let store: MessageEditorStore

	beforeEach(() => {
		store = new MessageEditorStore()
	})

	describe("EditorStore Integration", () => {
		it("should create store with initial state", () => {
			expect(store.editorStore).toBeDefined()
			expect(store.editorStore.value).toBeUndefined()
			expect(store.editorStore.isEmpty).toBe(true)
			expect(store.editorStore.tiptapEditor).toBeNull()
		})

		it("should sync value to editorStore", () => {
			const content = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: "Hello World",
							},
						],
					},
				],
			}

			store.editorStore.setValue(content)

			expect(store.editorStore.value).toEqual(content)
			expect(store.editorStore.isEmpty).toBe(false)
		})

		it("should handle composition state", () => {
			expect(store.editorStore.isComposing).toBe(false)

			store.editorStore.handleCompositionStart()
			expect(store.editorStore.isComposing).toBe(true)

			store.editorStore.handleCompositionEnd()
			expect(store.editorStore.isComposing).toBe(false)
		})

		it("should handle OAuth state", () => {
			expect(store.editorStore.isOAuthInProgress).toBe(false)

			store.editorStore.setOAuthInProgress(true)
			expect(store.editorStore.isOAuthInProgress).toBe(true)

			store.editorStore.setOAuthInProgress(false)
			expect(store.editorStore.isOAuthInProgress).toBe(false)
		})

		it("should clear content", () => {
			const content = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: "Test",
							},
						],
					},
				],
			}

			store.editorStore.setValue(content)
			expect(store.editorStore.isEmpty).toBe(false)

			store.editorStore.clearContent()
			expect(store.editorStore.value).toBeUndefined()
			expect(store.editorStore.isEmpty).toBe(true)
		})
	})

	describe("MessageEditorStore State", () => {
		it("should manage sending state", () => {
			expect(store.isSending).toBe(false)

			store.setIsSending(true)
			expect(store.isSending).toBe(true)

			store.setIsSending(false)
			expect(store.isSending).toBe(false)
		})

		it("should manage task running state", () => {
			expect(store.isTaskRunning).toBe(false)

			store.setIsTaskRunning(true)
			expect(store.isTaskRunning).toBe(true)

			store.setIsTaskRunning(false)
			expect(store.isTaskRunning).toBe(false)
		})

		it("should manage stop event loading state", () => {
			expect(store.stopEventLoading).toBe(false)

			store.setStopEventLoading(true)
			expect(store.stopEventLoading).toBe(true)

			store.setStopEventLoading(false)
			expect(store.stopEventLoading).toBe(false)
		})

		it("should compute canSendMessage correctly", () => {
			// Empty content, not sending
			expect(store.canSendMessage).toBe(false)

			// Has content, not sending
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello" }],
					},
				],
			})
			expect(store.canSendMessage).toBe(true)

			// Has content, but sending
			store.setIsSending(true)
			expect(store.canSendMessage).toBe(false)

			// Reset sending state
			store.setIsSending(false)
			expect(store.canSendMessage).toBe(true)

			// Clear content
			store.editorStore.clearContent()
			expect(store.canSendMessage).toBe(false)
		})
	})

	describe("Store Lifecycle", () => {
		it("should clear all content", () => {
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Test" }],
					},
				],
			})

			store.clearContent()

			expect(store.editorStore.value).toBeUndefined()
			expect(store.editorStore.isEmpty).toBe(true)
		})

		it("should dispose resources", () => {
			store.dispose()

			expect(store.editorStore.tiptapEditor).toBeNull()
		})
	})
})
