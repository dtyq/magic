import { describe, expect, it } from "vitest"
import { resolveAudioControlInteractionPolicy } from "../AudioElement.interaction"

describe("resolveAudioControlInteractionPolicy", () => {
	it("keeps full player interaction when desktop controls are comfortably visible", () => {
		expect(
			resolveAudioControlInteractionPolicy({
				screenWidth: 320,
				screenHeight: 180,
				coarsePointer: false,
			}),
		).toEqual({ mode: "full", controlsEnabled: true, progressMinimumScreenHeight: 32 })
	})

	it("uses compact track interaction only when the element remains large enough", () => {
		expect(
			resolveAudioControlInteractionPolicy({
				screenWidth: 240,
				screenHeight: 120,
				coarsePointer: false,
			}),
		).toEqual({ mode: "compact", controlsEnabled: true, progressMinimumScreenHeight: 16 })

		expect(
			resolveAudioControlInteractionPolicy({
				screenWidth: 160,
				screenHeight: 90,
				coarsePointer: false,
			}),
		).toEqual({ mode: "compact", controlsEnabled: false, progressMinimumScreenHeight: 16 })
	})

	it("requires more visible space for touch controls", () => {
		expect(
			resolveAudioControlInteractionPolicy({
				screenWidth: 320,
				screenHeight: 180,
				coarsePointer: true,
			}),
		).toEqual({ mode: "compact", controlsEnabled: true, progressMinimumScreenHeight: 24 })

		expect(
			resolveAudioControlInteractionPolicy({
				screenWidth: 220,
				screenHeight: 140,
				coarsePointer: true,
			}),
		).toEqual({ mode: "compact", controlsEnabled: false, progressMinimumScreenHeight: 24 })
	})
})
