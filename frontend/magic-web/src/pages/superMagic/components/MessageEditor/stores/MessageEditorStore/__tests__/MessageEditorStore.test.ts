import { describe, it, expect, beforeEach } from "vitest"
import { MessageEditorStore } from "../index"

describe("MessageEditorStore", () => {
	let store: MessageEditorStore

	beforeEach(() => {
		store = new MessageEditorStore()
	})

	describe("initialization", () => {
		it("should initialize with sub-stores", () => {
			expect(store.editorStore).toBeDefined()
			expect(store.draftStore).toBeDefined()
			expect(store.topicModelStore).toBeDefined()
		})

		it("should initialize with default global states", () => {
			expect(store.isSending).toBe(false)
			expect(store.isTaskRunning).toBe(false)
			expect(store.stopEventLoading).toBe(false)
		})
	})

	describe("canSendMessage computed", () => {
		it("should return false when editor is empty", () => {
			expect(store.editorStore.isEmpty).toBe(true)
			expect(store.canSendMessage).toBe(false)
		})

		it("should return false when isSending is true", () => {
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello" }],
					},
				],
			})

			store.setIsSending(true)

			expect(store.canSendMessage).toBe(false)
		})

		it("should return true when all conditions are met", () => {
			// Set content
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello" }],
					},
				],
			})

			// Ensure not sending
			store.setIsSending(false)

			expect(store.canSendMessage).toBe(true)
		})
	})

	describe("setIsSending", () => {
		it("should set sending state", () => {
			expect(store.isSending).toBe(false)

			store.setIsSending(true)
			expect(store.isSending).toBe(true)

			store.setIsSending(false)
			expect(store.isSending).toBe(false)
		})
	})

	describe("setIsTaskRunning", () => {
		it("should set task running state", () => {
			expect(store.isTaskRunning).toBe(false)

			store.setIsTaskRunning(true)
			expect(store.isTaskRunning).toBe(true)

			store.setIsTaskRunning(false)
			expect(store.isTaskRunning).toBe(false)
		})
	})

	describe("setStopEventLoading", () => {
		it("should set stop event loading state", () => {
			expect(store.stopEventLoading).toBe(false)

			store.setStopEventLoading(true)
			expect(store.stopEventLoading).toBe(true)

			store.setStopEventLoading(false)
			expect(store.stopEventLoading).toBe(false)
		})
	})

	describe("clearContent", () => {
		it("should clear editor content", () => {
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello" }],
					},
				],
			})

			expect(store.editorStore.value).toBeDefined()

			store.clearContent()

			expect(store.editorStore.value).toBeUndefined()
		})

		it("should handle clearing when already empty", () => {
			expect(store.editorStore.value).toBeUndefined()

			expect(() => store.clearContent()).not.toThrow()

			expect(store.editorStore.value).toBeUndefined()
		})
	})

	describe("dispose", () => {
		it("should dispose all sub-stores", () => {
			// Add some data
			store.editorStore.setValue({
				type: "doc",
				content: [{ type: "paragraph" }],
			})

			// Dispose
			store.dispose()

			// Verify cleanup
			expect(store.editorStore.tiptapEditor).toBeNull()
		})

		it("should not throw when disposing clean store", () => {
			expect(() => store.dispose()).not.toThrow()
		})
	})

	describe("integration tests", () => {
		it("should coordinate editor state for sending", () => {
			// Set editor content
			const content = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Check @file" }],
					},
				],
			}
			store.editorStore.setValue(content)

			// Verify state
			expect(store.editorStore.isEmpty).toBe(false)
			expect(store.canSendMessage).toBe(true)
		})

		it("should handle complex sending workflow", () => {
			// Setup: Add content
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Message" }],
					},
				],
			})

			// Can send initially
			expect(store.canSendMessage).toBe(true)

			// Start sending
			store.setIsSending(true)
			expect(store.canSendMessage).toBe(false)

			// Complete sending and clear
			store.setIsSending(false)
			store.clearContent()

			// Verify cleared
			expect(store.editorStore.isEmpty).toBe(true)
			expect(store.canSendMessage).toBe(false)
		})

		it("should handle editor content with mentions", () => {
			// Add content with mention node
			store.editorStore.setValue({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "Check " },
							{
								type: "mention",
								attrs: {
									type: "PROJECT_FILE",
									data: { file_id: "file-1", file_name: "test.txt" },
								},
							},
						],
					},
				],
			})

			// Content should not be empty
			expect(store.editorStore.isEmpty).toBe(false)
			expect(store.canSendMessage).toBe(true)
		})
	})

	describe("MobX reactivity", () => {
		it("should make canSendMessage reactive to editor changes", () => {
			expect(store.canSendMessage).toBe(false)

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
		})

		it("should make canSendMessage reactive to sending state", () => {
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

			store.setIsSending(true)
			expect(store.canSendMessage).toBe(false)

			store.setIsSending(false)
			expect(store.canSendMessage).toBe(true)
		})
	})
})
