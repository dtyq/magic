import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { conversationActions } from "../conversationActions"
import { editActions } from "../editActions"
import { viewActions } from "../viewActions"

function createReplacingAudioCanvas() {
	const audio = {
		id: "audio-1",
		type: "audio",
		contents: [{ contentId: "audio-content", src: "audios/voice.mp3" }],
		activeContentId: "audio-content",
		mainContentId: "audio-content",
	}
	const addToConversation = vi.fn()
	const locateProjectFile = vi.fn()
	const copy = vi.fn()
	const permissionManager = {
		can: vi.fn((capability: string) => Boolean(capability)),
		canAddSelectedMediaToConversation: vi.fn(),
	}
	const canvas = {
		selectionManager: { getSelectedIds: vi.fn(() => ["audio-1"]) },
		elementManager: { getElementData: vi.fn(() => audio) },
		mediaReplaceController: { isReplacing: vi.fn(() => true) },
		permissionManager,
		magicConfigManager: {
			config: {
				permissions: { elementMenuConversationActions: true },
				methods: { addToConversation, locateProjectFile },
			},
		},
		clipboardManager: { copy },
	} as unknown as Canvas
	permissionManager.canAddSelectedMediaToConversation = vi.fn(
		() =>
			permissionManager.can("sideEffect.copy") &&
			canvas.magicConfigManager.config?.permissions?.elementMenuConversationActions !== false,
	)
	return { canvas, addToConversation, locateProjectFile, copy }
}

describe("media replacement action guards", () => {
	it.each(["conversation.add-to-current", "conversation.add-to-new"] as const)(
		"blocks %s while the selected media is replacing",
		async (actionId) => {
			const { canvas, addToConversation } = createReplacingAudioCanvas()
			const action = conversationActions.find((candidate) => candidate.id === actionId)
			if (!action) throw new Error(`Expected ${actionId}`)

			expect(action.canExecute(canvas)).toBe(false)
			await action.execute(canvas)
			expect(addToConversation).not.toHaveBeenCalled()
		},
	)

	it("blocks locating the old project file while replacement is active", async () => {
		const { canvas, locateProjectFile } = createReplacingAudioCanvas()
		const action = viewActions.find((candidate) => candidate.id === "view.locate-project-file")
		if (!action) throw new Error("Expected view.locate-project-file")

		expect(action.canExecute(canvas, { elementId: "audio-1" })).toBe(false)
		await action.execute(canvas, { elementId: "audio-1" })
		expect(locateProjectFile).not.toHaveBeenCalled()
	})

	it("keeps structural copy available during replacement", async () => {
		const { canvas, copy } = createReplacingAudioCanvas()
		const action = editActions.find((candidate) => candidate.id === "edit.copy")
		if (!action) throw new Error("Expected edit.copy")

		expect(action.canExecute(canvas)).toBe(true)
		await action.execute(canvas)
		expect(copy).toHaveBeenCalledTimes(1)
	})

	it("blocks adding media to conversation when copy side effects are denied", async () => {
		const { canvas, addToConversation } = createReplacingAudioCanvas()
		canvas.permissionManager.can = vi.fn(() => false)
		const action = conversationActions.find(
			(candidate) => candidate.id === "conversation.add-to-current",
		)
		if (!action) throw new Error("Expected conversation.add-to-current")

		expect(action.canExecute(canvas)).toBe(false)
		await action.execute(canvas)
		expect(addToConversation).not.toHaveBeenCalled()
	})
})
