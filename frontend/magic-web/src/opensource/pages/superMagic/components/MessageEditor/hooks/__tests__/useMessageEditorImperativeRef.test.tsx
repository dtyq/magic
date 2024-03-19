import { createRef } from "react"
import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import useMessageEditorImperativeRef from "../useMessageEditorImperativeRef"

describe("useMessageEditorImperativeRef", () => {
	it("should expose clearContentAfterSend on the editor ref", () => {
		const ref = createRef<any>()
		const clearContentAfterSend = vi.fn()

		renderHook(() =>
			useMessageEditorImperativeRef({
				ref,
				tiptapEditor: null,
				canSendMessage: true,
				files: [],
				clearFiles: vi.fn(),
				store: {
					editorStore: {
						value: undefined,
					},
				} as any,
				clearContent: vi.fn(),
				clearContentAfterSend,
				updateContent: vi.fn(),
				focus: vi.fn(),
				addFiles: vi.fn().mockResolvedValue(undefined),
				loadDraftReady: vi.fn().mockResolvedValue(undefined),
				saveSuperMagicTopicModel: vi.fn(),
				setModels: vi.fn(),
			}),
		)

		expect(ref.current?.clearContentAfterSend).toBe(clearContentAfterSend)

		ref.current?.clearContentAfterSend()

		expect(clearContentAfterSend).toHaveBeenCalledTimes(1)
	})
})
