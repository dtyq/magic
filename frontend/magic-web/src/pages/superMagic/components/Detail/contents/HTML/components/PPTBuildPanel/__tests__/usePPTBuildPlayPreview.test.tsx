import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import { usePPTBuildPlayPreview } from "../usePPTBuildPlayPreview"

afterEach(() => vi.useRealTimers())

function setup(delays: Array<number | null>) {
	const previewPPTBuild = vi.fn(async () => {})
	const editorRef = { current: { previewPPTBuild } as unknown as HTMLEditorV2Ref }
	const hook = renderHook(() => usePPTBuildPlayPreview(editorRef, delays))
	return { previewPPTBuild, ...hook }
}

describe("usePPTBuildPlayPreview", () => {
	it("hides everything, reveals each step in order with its own timing, then restores", async () => {
		vi.useFakeTimers()
		const { result, previewPPTBuild } = setup([null, 500])
		await act(async () => {
			void result.current.play()
		})
		expect(previewPPTBuild).toHaveBeenLastCalledWith(0)
		expect(result.current.playing).toBe(true)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(900)
		})
		expect(previewPPTBuild).toHaveBeenLastCalledWith(1, true)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(749)
		})
		expect(previewPPTBuild).not.toHaveBeenCalledWith(2, true)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1)
		})
		expect(previewPPTBuild).toHaveBeenCalledWith(2, true)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000)
		})
		expect(previewPPTBuild).toHaveBeenLastCalledWith(null)
		expect(result.current.playing).toBe(false)
	})

	it("stops immediately and restores the full slide", async () => {
		vi.useFakeTimers()
		const { result, previewPPTBuild } = setup([null, null])
		await act(async () => {
			void result.current.play()
		})
		await act(async () => {
			await result.current.stop()
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(5000)
		})
		expect(previewPPTBuild).not.toHaveBeenCalledWith(1, true)
		expect(previewPPTBuild).toHaveBeenLastCalledWith(null)
		expect(result.current.playing).toBe(false)
	})

	it("does nothing without steps", async () => {
		const { result, previewPPTBuild } = setup([])
		await act(async () => {
			await result.current.play()
		})
		expect(previewPPTBuild).not.toHaveBeenCalled()
	})
})
