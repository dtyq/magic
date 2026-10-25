import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePPTBuildPlayback, type PPTBuildController } from "../usePPTBuildPlayback"
import { setPPTBuildFrame } from "../../utils/pptBuildBridge"
vi.mock("../../utils/pptBuildBridge", () => ({ setPPTBuildFrame: vi.fn() }))
const setFrame = vi.mocked(setPPTBuildFrame)
beforeEach(() => {
	setFrame.mockReset()
	setFrame.mockResolvedValue({ step: 0, total: 3 })
})
function setup() {
	let controller: PPTBuildController | null = null
	const onController = vi.fn((value: PPTBuildController | null) => {
		controller = value
	})
	const onFailure = vi.fn()
	const frame = document.createElement("iframe")
	const props = {
		documentKey: "a",
		hasBuilds: true,
		enabled: true,
		active: true,
		getIframe: () => frame,
		onController,
		onFailure,
	}
	const hook = renderHook((value) => usePPTBuildPlayback(value), { initialProps: props })
	act(() => {
		void hook.result.current.initialize(true)
	})
	return { ...hook, props, onController, onFailure, getController: () => controller }
}
describe("PPT build playback lifecycle", () => {
	it("waits for a cold runtime before sending initialization", async () => {
		const frame = document.createElement("iframe")
		const onController = vi.fn()
		const h = renderHook(() =>
			usePPTBuildPlayback({
				documentKey: "cold",
				hasBuilds: true,
				enabled: true,
				active: true,
				getIframe: () => frame,
				onController,
				onFailure: vi.fn(),
			}),
		)
		expect(setFrame).not.toHaveBeenCalled()
		await act(() => h.result.current.initialize(true))
		expect(setFrame).toHaveBeenCalledOnce()
	})
	it("acknowledges each absolute step and preserves progress across unchanged renders", async () => {
		const h = setup()
		await waitFor(() => expect(h.getController()?.state.total).toBe(3))
		setFrame.mockResolvedValueOnce({ step: 1, total: 3 })
		await act(() => h.getController()!.setStep(1, true))
		expect(h.getController()?.state.step).toBe(1)
		h.rerender({ ...h.props })
		expect(h.getController()?.state.step).toBe(1)
		expect(h.result.current.preparing).toBe(false)
	})
	it("aborts old-document requests and rejects their late acknowledgements", async () => {
		const requests: Array<{
			resolve: (value: { step: number; total: number }) => void
			signal: AbortSignal
		}> = []
		setFrame.mockImplementation(
			(_frame, _key, _enabled, _step, _animate, signal) =>
				new Promise((resolve) => requests.push({ resolve, signal: signal! })),
		)
		const h = setup()
		expect(h.result.current.preparing).toBe(true)
		h.rerender({ ...h.props, documentKey: "b" })
		act(() => {
			void h.result.current.initialize(true)
		})
		expect(requests[0].signal.aborted).toBe(true)
		await act(async () => requests[0].resolve({ step: 2, total: 7 }))
		expect(h.getController()).toBeNull()
		await act(async () => requests[1].resolve({ step: 0, total: 2 }))
		expect(h.getController()?.state).toEqual({ step: 0, total: 2 })
		expect(h.onFailure).not.toHaveBeenCalled()
	})
	it("fails open once and allows a rebuilt complete frame to become ready", async () => {
		setFrame.mockResolvedValue(null)
		const h = setup()
		await waitFor(() => expect(h.result.current.failed).toBe(true))
		expect(h.onFailure).toHaveBeenCalledOnce()
		await act(() => h.result.current.initialize(true))
		expect(h.getController()?.state.total).toBe(0)
		expect(h.result.current.preparing).toBe(false)
	})
})
