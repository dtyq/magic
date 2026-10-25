import { describe, expect, it, vi } from "vitest"
import { animatePPTTransition, getPPTTransitionKeyframes } from "../pptTransitionAnimation"

describe("fixed slide transition effects", () => {
	it("keeps none static and provides frames for each supported effect", () => {
		expect(getPPTTransitionKeyframes({ effect: "none" })).toBeNull()
		for (const effect of ["fade", "push", "cover", "wipe", "zoom"] as const) {
			const frames = getPPTTransitionKeyframes({ effect })
			expect(frames?.incoming).toHaveLength(2)
			expect(frames?.outgoing).toHaveLength(2)
		}
	})
	it("reverses directional navigation and moves both push layers in stage coordinates", () => {
		expect(getPPTTransitionKeyframes({ effect: "push", direction: "left" }, true)).toEqual({
			incoming: [{ transform: "translateX(-100%)" }, { transform: "translateX(0%)" }],
			outgoing: [{ transform: "translateX(0%)" }, { transform: "translateX(100%)" }],
		})
		expect(
			getPPTTransitionKeyframes({ effect: "cover", direction: "up" })?.incoming[0],
		).toEqual({ transform: "translateY(100%)" })
		expect(
			getPPTTransitionKeyframes({ effect: "wipe", direction: "down" })?.incoming[0],
		).toEqual({ clipPath: "inset(0 0 100% 0)" })
		expect(getPPTTransitionKeyframes({ effect: "zoom" })?.incoming[0]).toEqual({
			transform: "scale(0.96)",
			opacity: 0,
		})
	})
	it("settles without WAAPI and cleans partial animations when a browser throws", async () => {
		const outgoing = document.createElement("div")
		const incoming = document.createElement("div")
		await expect(
			animatePPTTransition(outgoing, incoming, { effect: "fade" }).finished,
		).resolves.toBeUndefined()
		const cancel = vi.fn()
		outgoing.animate = vi.fn(
			() => ({ finished: Promise.resolve(), cancel }) as unknown as Animation,
		)
		incoming.animate = vi.fn(() => {
			throw new Error("unsupported")
		})
		await animatePPTTransition(outgoing, incoming, { effect: "fade" }).finished
		expect(cancel).toHaveBeenCalledOnce()
	})
})
