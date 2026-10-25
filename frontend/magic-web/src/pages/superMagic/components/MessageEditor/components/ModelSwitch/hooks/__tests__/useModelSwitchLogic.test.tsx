import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useModelSwitchLogic } from "../useModelSwitchLogic"
import type { ModelItem } from "../../types"

vi.mock("@/hooks/useIsMobile", () => ({
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

	it("should close after selecting a model when configured", async () => {
		const { result } = renderHook(() =>
			useModelSwitchLogic({
				onModelClick: vi.fn(),
				shouldCloseOnSelect: true,
			}),
		)

		await act(async () => {
			await result.current.handleOpenChange(true)
		})
		act(() => result.current.handleModelClick({ model_id: "selected-model" } as ModelItem))

		expect(result.current.isOpen).toBe(false)
	})

	describe("scrolling to the selected model on open", () => {
		function rect(top: number, height: number) {
			return { top, bottom: top + height, height } as DOMRect
		}

		async function openWithLayout(itemTop: number) {
			vi.useFakeTimers()
			const container = document.createElement("div")
			const header = document.createElement("div")
			header.setAttribute("data-model-switch-group-header", "")
			header.style.position = "sticky"
			Object.defineProperty(header, "offsetHeight", { value: 28 })
			const item = document.createElement("div")
			container.append(header, item)
			document.body.append(container)
			container.getBoundingClientRect = () => rect(100, 300)
			item.getBoundingClientRect = () => rect(itemTop, 32)
			container.scrollTo = vi.fn() as typeof container.scrollTo

			const { result } = renderHook(() => useModelSwitchLogic({ onModelClick: vi.fn() }))
			Object.assign(result.current.desktopScrollContainerRef, { current: container })
			Object.assign(result.current.selectedItemRef, { current: item })
			await act(async () => {
				await result.current.handleOpenChange(true)
			})
			act(() => {
				vi.advanceTimersByTime(200)
			})
			vi.useRealTimers()
			container.remove()
			return container.scrollTo as ReturnType<typeof vi.fn>
		}

		it("leaves the list alone when the selected row is already fully visible", async () => {
			const scrollTo = await openWithLayout(200)
			expect(scrollTo).not.toHaveBeenCalled()
		})

		it("stops the selected row below the sticky group header", async () => {
			// 行在可视区下方 500px 处：滚动目标是行的偏移量减去吸顶标题高度。
			const scrollTo = await openWithLayout(600)
			expect(scrollTo).toHaveBeenCalledWith({ top: 500 - 28, behavior: "smooth" })
		})
	})
})
