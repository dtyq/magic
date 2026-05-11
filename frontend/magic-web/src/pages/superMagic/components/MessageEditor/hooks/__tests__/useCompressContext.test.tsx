import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import useCompressContext from "../useCompressContext"

describe("useCompressContext", () => {
	it("should send compact command without clearing editor content", () => {
		const handleSendMessageByContent = vi.fn()

		const { result } = renderHook(() =>
			useCompressContext({
				handleSendMessageByContent,
			}),
		)

		act(() => {
			result.current.handleCompressContext()
		})

		expect(handleSendMessageByContent).toHaveBeenCalledWith({
			jsonContent: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "/compact" }],
					},
				],
			},
			shouldClearEditorAfterSend: false,
		})
	})
})
