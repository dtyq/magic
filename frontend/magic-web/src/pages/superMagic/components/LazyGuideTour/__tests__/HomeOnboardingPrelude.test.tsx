import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
	holdHomeOnboardingPrelude,
	isHomeOnboardingPreludeHeld,
	releaseHomeOnboardingPrelude,
	useHomeOnboardingPreludeHeld,
} from "../onboardingPrelude"

/**
 * The ordering rule that puts the new-user onboarding behind the dialogs it did not replace.
 *
 * A new account is shown a profile dialog and, on a day the claim paid out, a daily reward dialog —
 * both of them whole-screen overlays, and both of them before this feature's own introduction. The
 * feature is the last of the three, and the only thing that says so is whether some other dialog
 * holds the screen. The rule is kept here rather than derived from those dialogs' own conditions,
 * which live in the layer that shows them and are true in builds that show nothing at all; that
 * reasoning is in `onboardingPrelude.ts` rather than repeated here.
 *
 * What this file pins is the bookkeeping: a hold is up until it is given back, holds do not clear
 * each other, and the answer is followed rather than read once.
 */

/** Every hold this suite can take, so one case cannot decide what the next one starts from. */
const EVERY_HOLD = ["user-profile-dialog", "daily-reward-dialog", "daily-reward-claim"] as const

afterEach(() => {
	EVERY_HOLD.forEach((dialog) => releaseHomeOnboardingPrelude(dialog))
})

describe("the holds taken ahead of the onboarding", () => {
	it("is free until something takes a hold", () => {
		expect(isHomeOnboardingPreludeHeld()).toBe(false)

		holdHomeOnboardingPrelude("user-profile-dialog")
		expect(isHomeOnboardingPreludeHeld()).toBe(true)

		releaseHomeOnboardingPrelude("user-profile-dialog")
		expect(isHomeOnboardingPreludeHeld()).toBe(false)
	})

	it("keeps holding while any one of them still has the screen", () => {
		/*
		 * The lifetimes overlap in the direction that matters: the profile dialog is up first and the
		 * reward claim is decided while it is still there, so the first release must not open the
		 * gate — the claim is a step of the same prelude, not a second one.
		 */
		holdHomeOnboardingPrelude("user-profile-dialog")
		holdHomeOnboardingPrelude("daily-reward-claim")

		releaseHomeOnboardingPrelude("daily-reward-claim")
		expect(isHomeOnboardingPreludeHeld()).toBe(true)

		releaseHomeOnboardingPrelude("user-profile-dialog")
		expect(isHomeOnboardingPreludeHeld()).toBe(false)
	})

	it("does not let a release clear a hold it never took", () => {
		/*
		 * The failure the keying exists to prevent: two independent pieces of code, one of them
		 * ending (or merely tidying up) while the other still owns the screen. A single shared
		 * boolean would read "free" here, and the onboarding would paint over a dialog that is up.
		 */
		holdHomeOnboardingPrelude("daily-reward-claim")

		releaseHomeOnboardingPrelude("user-profile-dialog")

		expect(isHomeOnboardingPreludeHeld()).toBe(true)
	})

	it("takes one hold however often the same caller asks for it", () => {
		// A dialog may be re-shown by the code that already holds for it (a replacement carrier, a
		// second claim attempt); the pair still has to be releasable by a single release.
		holdHomeOnboardingPrelude("daily-reward-dialog")
		holdHomeOnboardingPrelude("daily-reward-dialog")

		releaseHomeOnboardingPrelude("daily-reward-dialog")

		expect(isHomeOnboardingPreludeHeld()).toBe(false)
	})
})

describe("useHomeOnboardingPreludeHeld", () => {
	it("follows the holds without the surface being remounted", () => {
		const { result } = renderHook(() => useHomeOnboardingPreludeHeld())
		expect(result.current).toBe(false)

		// The reward dialog opens long after the first paint — the claim it reports is a request —
		// so a surface that only read this on mount would keep its hold answer from before it.
		act(() => holdHomeOnboardingPrelude("daily-reward-dialog"))
		expect(result.current).toBe(true)

		act(() => releaseHomeOnboardingPrelude("daily-reward-dialog"))
		expect(result.current).toBe(false)
	})

	it("starts held when a dialog is already up", () => {
		/*
		 * The profile dialog is opened from a layout effect of the shell a page mounts inside, so the
		 * page's own surfaces mount after the hold is up. Reading the answer as the state's initial
		 * value — rather than `false` corrected by an effect — is what keeps them from painting once
		 * under a dialog before standing aside.
		 */
		holdHomeOnboardingPrelude("user-profile-dialog")

		const { result } = renderHook(() => useHomeOnboardingPreludeHeld())
		expect(result.current).toBe(true)

		act(() => releaseHomeOnboardingPrelude("user-profile-dialog"))
		expect(result.current).toBe(false)
	})
})
