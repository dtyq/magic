import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePPTTransitionDraft, type PPTTransitionPanelProps } from "../usePPTTransitionDraft"
import { applyPPTTransitionEdit } from "../../utils/pptTransitions"

function props(overrides: Partial<PPTTransitionPanelProps> = {}): PPTTransitionPanelProps {
	return {
		open: true,
		deckKey: "deck-a",
		activePath: "a.html",
		selectedPaths: ["a.html", "b.html"],
		slides: [
			{ path: "a.html", label: "A" },
			{ path: "b.html", label: "B" },
		],
		config: {
			default: { effect: "fade", duration_ms: 700, easing: "linear" },
			slides: {
				"a.html": {
					effect: "push",
					direction: "right",
					duration_ms: 500,
					easing: "linear",
				},
				"b.html": {
					effect: "cover",
					direction: "up",
					duration_ms: 800,
					easing: "ease-in-out",
				},
			},
		},
		busy: false,
		onSave: vi.fn().mockResolvedValue(true),
		onOpenChange: vi.fn(),
		...overrides,
	}
}

describe("usePPTTransitionDraft", () => {
	it("requires choosing a supported preset before replacing an unknown deck default", async () => {
		const initial = props({ config: { default: { effect: "future" } } })
		const { result } = renderHook(() => usePPTTransitionDraft(initial))
		act(() => result.current.setScope("all"))
		await act(async () => {
			expect(await result.current.save()).toBe(false)
		})
		expect(initial.onSave).not.toHaveBeenCalled()
		act(() => result.current.selectEffect("none"))
		await act(async () => {
			expect(await result.current.save()).toBe(true)
		})
		expect(initial.onSave).toHaveBeenCalledWith(
			expect.objectContaining({ scope: "all", transition: { effect: "none" } }),
		)
	})

	it("preserves each target's unrelated fields when editing a mixed batch", async () => {
		const initial = props({ initialScope: "selected" })
		const { result } = renderHook(() => usePPTTransitionDraft(initial))
		act(() => result.current.changeParameter({ duration_ms: 300 }))
		expect(initial.onSave).not.toHaveBeenCalled()
		await act(async () => {
			await result.current.save()
		})
		const edit = vi.mocked(initial.onSave).mock.calls[0][0]
		expect(edit.patch).toEqual({ duration_ms: 300 })
		expect(applyPPTTransitionEdit(initial.config, ["a.html", "b.html"], edit)).toMatchObject({
			slides: {
				"a.html": {
					effect: "push",
					direction: "right",
					duration_ms: 300,
					easing: "linear",
				},
				"b.html": {
					effect: "cover",
					direction: "up",
					duration_ms: 300,
					easing: "ease-in-out",
				},
			},
		})
	})
	it("keeps a failed draft and close guard pending until explicitly cancelled", async () => {
		const initial = props({ onSave: vi.fn().mockResolvedValue(false) })
		const { result } = renderHook(() => usePPTTransitionDraft(initial))
		act(() => result.current.selectEffect("zoom"))
		let close = Promise.resolve(false)
		act(() => {
			close = result.current.requestClose()
		})
		await act(async () => {
			await result.current.save()
		})
		expect(result.current.failed).toBe(true)
		expect(result.current.confirmClose).toBe(true)
		expect(result.current.transitions[0].effect).toBe("zoom")
		expect(initial.onOpenChange).not.toHaveBeenCalled()
		act(() => result.current.finishClose(false))
		expect(await close).toBe(false)
	})
	it("saves captured paths after an external page change and refuses a different deck", async () => {
		const initial = props()
		const { result, rerender } = renderHook(usePPTTransitionDraft, { initialProps: initial })
		act(() => result.current.selectEffect("none"))
		rerender({ ...initial, activePath: "b.html" })
		expect(result.current.confirmClose).toBe(true)
		await act(async () => {
			await result.current.save()
		})
		expect(initial.onSave).toHaveBeenCalledWith(
			expect.objectContaining({ paths: ["a.html"], transition: { effect: "none" } }),
		)
		rerender({ ...initial, deckKey: "deck-b", activePath: "b.html" })
		await act(async () => {
			expect(await result.current.save()).toBe(false)
		})
		expect(initial.onSave).toHaveBeenCalledTimes(1)
	})
	it("restores overrides and preserves actual default parameters when switching to all", async () => {
		const initial = props()
		const { result } = renderHook(() => usePPTTransitionDraft(initial))
		act(() => result.current.restoreDefault())
		expect(result.current.transitions[0]).toEqual({
			effect: "fade",
			duration_ms: 700,
			easing: "linear",
		})
		act(() => result.current.setScope("all"))
		await act(async () => {
			await result.current.save()
		})
		const edit = vi.mocked(initial.onSave).mock.calls[0][0]
		expect(edit).toMatchObject({
			scope: "all",
			transition: { effect: "fade", duration_ms: 700, easing: "linear" },
		})
		expect(applyPPTTransitionEdit(initial.config, ["a.html", "b.html"], edit)).toMatchObject({
			slides: {},
		})
	})
	it("retains the opening snapshot when settings update externally", async () => {
		const initial = props()
		const { result, rerender } = renderHook(usePPTTransitionDraft, { initialProps: initial })
		act(() => result.current.selectEffect("fade"))
		rerender({ ...initial, config: { default: { effect: "none" } } })
		await act(async () => {
			await result.current.save()
		})
		expect(initial.onSave).toHaveBeenCalledWith(
			expect.objectContaining({ expectedTransitions: initial.config }),
		)
	})
	it("ignores a late save result after switching decks", async () => {
		let complete!: (value: boolean) => void
		const initial = props({
			onSave: vi.fn(
				() =>
					new Promise<boolean>((resolve) => {
						complete = resolve
					}),
			),
		})
		const { result, rerender } = renderHook(usePPTTransitionDraft, { initialProps: initial })
		act(() => result.current.selectEffect("fade"))
		let save!: Promise<boolean>
		act(() => {
			save = result.current.save()
		})
		rerender({ ...initial, deckKey: "deck-b" })
		await act(async () => {
			complete(true)
			await save
		})
		expect(initial.onOpenChange).not.toHaveBeenCalled()
	})
	it("registers a navigation guard that resolves only after discard", async () => {
		const registerBeforeClose = vi.fn()
		const initial = props({ registerBeforeClose })
		const { result, unmount } = renderHook(() => usePPTTransitionDraft(initial))
		act(() => result.current.selectEffect("push"))
		const guard = registerBeforeClose.mock.calls.at(-1)?.[0]
		let close!: Promise<boolean>
		act(() => {
			close = guard()
		})
		expect(result.current.confirmClose).toBe(true)
		act(() => result.current.finishClose(true))
		expect(await close).toBe(true)
		unmount()
		expect(registerBeforeClose).toHaveBeenLastCalledWith(null)
	})
})
