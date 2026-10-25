import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GenerationRuntimeManager } from "../../../../../runtime/generation/GenerationRuntimeManager"
import { useMediaEditorSubmission } from "../useMediaEditorSubmission"

const mocks = vi.hoisted(() => ({
	generationRuntimeManager: null as GenerationRuntimeManager | null,
}))

vi.mock("../../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: {
			generationRuntimeManager: mocks.generationRuntimeManager,
		},
	}),
}))

function createController() {
	return renderHook(() =>
		useMediaEditorSubmission({
			elementId: "image-1",
			contentId: "content-1",
			isGenerating: false,
			isTimedOut: false,
			isRetryEditing: false,
		}),
	)
}

describe("useMediaEditorSubmission", () => {
	beforeEach(() => {
		mocks.generationRuntimeManager = new GenerationRuntimeManager()
	})

	it("hides immediately and stays hidden after the backend accepts", async () => {
		const manager = mocks.generationRuntimeManager as GenerationRuntimeManager
		const { result } = createController()
		let resolveSubmission!: (value: { accepted: boolean }) => void

		act(() => {
			void result.current.run({
				initialPhase: "preparing",
				execute: () =>
					new Promise<{ accepted: boolean }>((resolve) => {
						resolveSubmission = resolve
					}),
			})
		})

		expect(result.current.hidden).toBe(true)
		expect(manager.getSubmissionState("image-1", "content-1")?.phase).toBe("preparing")
		expect(result.current.busy).toBe(true)

		await act(async () => resolveSubmission({ accepted: true }))

		await waitFor(() => expect(manager.getSubmissionState("image-1", "content-1")).toBeNull())
		expect(result.current.hidden).toBe(true)
		expect(result.current.busy).toBe(false)
	})

	it("reveals the editor when submission is rejected", async () => {
		const manager = mocks.generationRuntimeManager as GenerationRuntimeManager
		const { result } = createController()
		let resolveSubmission!: (value: { accepted: boolean }) => void

		act(() => {
			void result.current.run({
				initialPhase: "validating",
				execute: () =>
					new Promise<{ accepted: boolean }>((resolve) => {
						resolveSubmission = resolve
					}),
			})
		})

		expect(result.current.hidden).toBe(true)

		await act(async () => resolveSubmission({ accepted: false }))

		await waitFor(() => expect(manager.getSubmissionState("image-1", "content-1")).toBeNull())
		expect(result.current.hidden).toBe(false)
	})

	it("reveals a submitted editor only through the explicit reveal path", async () => {
		const { result } = createController()

		await act(async () => {
			await result.current.run({
				initialPhase: "submitting",
				execute: async () => ({ accepted: true }),
			})
		})

		expect(result.current.hidden).toBe(true)
		act(() => result.current.reveal())
		expect(result.current.hidden).toBe(false)
	})
})
