import { act, renderHook } from "@testing-library/react"
import { createRef } from "react"
import useServerUpdate from "../useServerUpdate"

describe("useServerUpdate", () => {
	it("should block save and open confirm dialog when server update exists", () => {
		const { result } = renderHook(() =>
			useServerUpdate({
				externalServerUpdatedContent: "<div>server</div>",
				isEditMode: true,
				rendererRef: createRef(),
				content: "<div>base</div>",
			}),
		)

		let canSave = true

		act(() => {
			canSave = result.current.checkServerUpdateBeforeSave()
		})

		expect(canSave).toBe(false)
		expect(result.current.showSaveWithUpdateConfirmDialog).toBe(true)
	})

	it("should support code-mode fallback getters and appliers", async () => {
		const appliedContents: string[] = []

		const { result } = renderHook(() =>
			useServerUpdate({
				externalServerUpdatedContent: "<div>server</div>",
				isEditMode: true,
				rendererRef: createRef(),
				content: "<div>base</div>",
				getCurrentEditingContent: async () => "<div>local</div>",
				applyContent: (nextContent) => {
					appliedContents.push(nextContent)
				},
			}),
		)

		await act(async () => {
			await result.current.handleViewServerUpdate()
		})

		expect(result.current.currentEditingContent).toBe("<div>local</div>")
		expect(result.current.showVersionCompareDialog).toBe(true)

		act(() => {
			result.current.handleUseServerVersion()
		})

		expect(appliedContents).toEqual(["<div>server</div>"])
		expect(result.current.showVersionCompareDialog).toBe(false)
	})
})
