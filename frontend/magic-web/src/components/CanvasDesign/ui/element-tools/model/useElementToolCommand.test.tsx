import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ElementToolTypeEnum } from "../../../public/props"
import { useElementToolCommand } from "./useElementToolCommand"

const mocks = vi.hoisted(() => ({
	register: vi.fn(),
	bus: {
		register: vi.fn(),
	},
}))

mocks.bus.register = mocks.register

vi.mock("../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: {
			elementToolCommandBus: mocks.bus,
		},
	}),
}))

describe("useElementToolCommand", () => {
	it("does not re-register when only the handler closure changes", () => {
		const unregister = vi.fn()
		let registeredHandler: ((command: unknown) => unknown) | undefined
		mocks.register.mockImplementation((_key, handler) => {
			registeredHandler = handler
			return unregister
		})

		const firstExecute = vi.fn()
		const secondExecute = vi.fn()
		const { rerender } = renderHook(
			({ execute }) => {
				useElementToolCommand({
					elementId: "image-1",
					contentId: "content-a",
					toolId: ElementToolTypeEnum.GenerationGenerateAgain,
					execute,
				})
			},
			{ initialProps: { execute: firstExecute } },
		)

		rerender({ execute: secondExecute })

		expect(mocks.register).toHaveBeenCalledTimes(1)
		registeredHandler?.({
			elementId: "image-1",
			contentId: "content-a",
			toolId: ElementToolTypeEnum.GenerationGenerateAgain,
		})
		expect(firstExecute).not.toHaveBeenCalled()
		expect(secondExecute).toHaveBeenCalledTimes(1)
	})
})
