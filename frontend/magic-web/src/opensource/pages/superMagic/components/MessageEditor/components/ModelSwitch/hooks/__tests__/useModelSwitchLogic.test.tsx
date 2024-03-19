import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useModelSwitchLogic } from "../useModelSwitchLogic"

vi.mock("@/opensource/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../../utils", () => ({
	isModelDisabled: vi.fn(() => false),
}))

describe("useModelSwitchLogic", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should validate current selection before opening", async () => {
		const onBeforeOpen = vi.fn(async () => undefined)
		const { result } = renderHook(() =>
			useModelSwitchLogic({
				onModelClick: vi.fn(),
				onBeforeOpen,
			}),
		)

		await act(async () => {
			await result.current.handleOpenChange(true)
		})

		expect(onBeforeOpen).toHaveBeenCalledTimes(1)
		expect(result.current.isOpen).toBe(true)
	})

	it("should not validate again when closing", async () => {
		const onBeforeOpen = vi.fn(async () => undefined)
		const { result } = renderHook(() =>
			useModelSwitchLogic({
				onModelClick: vi.fn(),
				onBeforeOpen,
			}),
		)

		await act(async () => {
			await result.current.handleOpenChange(true)
		})
		await act(async () => {
			await result.current.handleOpenChange(false)
		})

		expect(onBeforeOpen).toHaveBeenCalledTimes(1)
		expect(result.current.isOpen).toBe(false)
	})
})
