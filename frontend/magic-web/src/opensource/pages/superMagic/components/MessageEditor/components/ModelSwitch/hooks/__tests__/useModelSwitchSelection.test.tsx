import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isModelDisabled } from "../../utils"
import type { ModelItem } from "../../types"
import { useModelSwitchSelection } from "../useModelSwitchSelection"

vi.mock("../../utils", () => ({
	isModelDisabled: vi.fn(() => false),
}))

describe("useModelSwitchSelection", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should open subscription modal for disabled VIP models", () => {
		vi.mocked(isModelDisabled).mockReturnValue(true)
		const onModelClick = vi.fn()
		const onModelSelected = vi.fn()
		const { result } = renderHook(() =>
			useModelSwitchSelection({
				onModelClick,
				onModelSelected,
			}),
		)

		act(() => {
			result.current.handleModelClick({
				model_id: "vip-model",
				tags: ["VIP"],
			} as ModelItem)
		})

		expect(onModelClick).not.toHaveBeenCalled()
		expect(onModelSelected).not.toHaveBeenCalled()
		expect(result.current.isOpeningModal).toBe(true)
	})

	it("should select available models and run post selection callback", () => {
		const onModelClick = vi.fn()
		const onModelSelected = vi.fn()
		const { result } = renderHook(() =>
			useModelSwitchSelection({
				onModelClick,
				onModelSelected,
			}),
		)

		act(() => {
			result.current.handleModelClick({
				model_id: "available-model",
			} as ModelItem)
		})

		expect(onModelClick).toHaveBeenCalledWith({
			model_id: "available-model",
		})
		expect(onModelSelected).toHaveBeenCalledTimes(1)
	})
})
