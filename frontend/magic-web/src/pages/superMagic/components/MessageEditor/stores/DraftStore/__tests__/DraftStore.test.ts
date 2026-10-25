import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { DraftStore } from "../index"
import { EditorStore } from "../../EditorStore"
import { draftManager } from "../../../services/draftService"

vi.mock("../../../services/draftService", () => ({
	draftManager: {
		saveDraft: vi.fn(),
		createSentDraft: vi.fn(),
		loadLatestDraftVersion: vi.fn(),
	},
}))

const mockDraftManager = vi.mocked(draftManager)

function createContent(text: string) {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text }],
			},
		],
	}
}

describe("DraftStore", () => {
	let store: DraftStore

	beforeEach(() => {
		store = new DraftStore(new EditorStore())
		store.setDraftKey({
			workspaceId: "workspace",
			projectId: "project",
			topicId: "topic",
		})
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("should skip saving when not ready, sending, or composing", () => {
		const content = createContent("Hello")

		store.isDraftReady = false
		store.handleContentChange({ value: content, isComposing: false })
		expect(mockDraftManager.saveDraft).not.toHaveBeenCalled()

		store.isDraftReady = true
		store.isSendingGuard = true
		store.handleContentChange({ value: content, isComposing: false })
		expect(mockDraftManager.saveDraft).not.toHaveBeenCalled()

		store.isSendingGuard = false
		store.handleContentChange({ value: content, isComposing: true })
		expect(mockDraftManager.saveDraft).not.toHaveBeenCalled()
	})

	it("should save draft when ready and not sending", () => {
		const content = createContent("Draft content")

		store.isDraftReady = true
		store.handleContentChange({ value: content, isComposing: false })

		expect(mockDraftManager.saveDraft).toHaveBeenCalledWith({
			workspaceId: "workspace",
			projectId: "project",
			topicId: "topic",
			value: content,
		})
	})

	it("strips pending canvas mentions before saving a draft", () => {
		store.isDraftReady = true
		const content = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Keep " },
						{
							type: "mention",
							attrs: {
								type: "project_file",
								data: { file_id: "pending", file_name: "pending.png" },
								pending: true,
							},
						},
					],
				},
			],
		}

		store.handleContentChange({ value: content, isComposing: false })

		expect(mockDraftManager.saveDraft).toHaveBeenCalledWith({
			workspaceId: "workspace",
			projectId: "project",
			topicId: "topic",
			value: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Keep " }],
					},
				],
			},
		})
	})

	it("should reset sending guard after createSentDraft", async () => {
		vi.useFakeTimers()

		store.isSendingGuard = true
		mockDraftManager.createSentDraft.mockResolvedValue(undefined)

		await store.createSentDraft({ value: createContent("sent") })

		expect(store.isSendingGuard).toBe(true)

		vi.advanceTimersByTime(1000)
		expect(store.isSendingGuard).toBe(false)
	})

	it("should clear content when no draft exists", async () => {
		const clearContentHandler = vi.fn()
		store.setClearContentHandler(clearContentHandler)
		mockDraftManager.loadLatestDraftVersion.mockResolvedValue(null)

		await store.loadLatestDraft()

		expect(clearContentHandler).toHaveBeenCalled()
		expect(store.isDraftReady).toBe(true)
	})
})
