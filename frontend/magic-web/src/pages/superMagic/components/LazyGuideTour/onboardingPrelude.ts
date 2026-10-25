import { useEffect, useState } from "react"

/**
 * The dialogs a new account is shown *before* this feature's own introduction.
 *
 * A brand-new account is met by a fixed sequence that predates the new-user onboarding: the profile
 * dialog ("完善基本信息，让团队更了解你") asks for a name, and the daily reward dialog
 * ("每日登录奖励") reports the points the day's claim has just paid. Both are whole-screen overlays
 * with a mask over the page — and so is the introduction dialog this feature opens on a first visit
 * to the home page. Three dialogs, each of them wanting to be the first thing the user sees; the
 * order the product wants is the order above, with the new-user onboarding **last**, never the one
 * that lands on top of another.
 *
 * A dialog takes a **hold** while it is on screen and releases it when it is gone. Everything that
 * carries the onboarding reads whether any hold is up before it starts, which is all the ordering
 * the feature needs: the introduction dialog is not delayed so much as not opened yet, and nothing
 * is spent while it waits — the one-shot introduction is not consumed, and the benefits card does
 * not even mount to ask for its list.
 *
 * Why holds rather than a predicate over those dialogs' own conditions — `nickname === ""` for the
 * profile one, "the claim was granted today" for the reward one: those conditions belong to the
 * code that decides to show the dialog, one of them in another layer entirely, and a copy of them
 * here would be a second source of truth that is stale from the moment either is adjusted. The copy
 * would also be wrong in both directions. It would hold the feature off for an account that has an
 * empty nickname in a build with no trigger for that dialog at all — the open-source baseline has
 * none — and it would still miss the reward dialog, which is decided by a response that arrives
 * long after the conditions could be read.
 *
 * Holds are keyed rather than kept as one shared boolean, because they are taken by independent
 * pieces of code whose lifetimes overlap: a claim can resolve while the profile dialog is still up,
 * and the claim's own hold ends as the reward dialog's begins — releasing one must not clear
 * another's. Taking a hold that is already taken changes nothing, so a caller may take it as often
 * as its own logic likes and the callers never have to coordinate.
 */
export type HomeOnboardingPreludeDialog =
	/** The profile dialog, while it is on screen. */
	| "user-profile-dialog"
	/** The daily reward dialog, while it is on screen. */
	| "daily-reward-dialog"
	/**
	 * The daily reward **claim**, from the request until its answer has been dealt with. The dialog
	 * above only exists for a claim that came back granted, and it is the answer — not anything
	 * readable before it — that says whether it will. Holding from the request is what keeps the
	 * onboarding from taking the screen during that round trip and having the dialog open over it.
	 */
	| "daily-reward-claim"
	/**
	 * Another account is being signed in and the page is about to be rebuilt for it — the
	 * "add account" flow, which reloads once the client has switched to the newly added account.
	 *
	 * The only one of these that is not a dialog, and the only one taken on a surface the
	 * onboarding does not otherwise know about. It is here because the reload is the whole point:
	 * the introduction dialog spends itself the moment it is painted, so a dialog opened in the
	 * beat between the sign-in and the reload would be wiped by that reload without the account
	 * ever having been able to act on it — shown once and lost for good, since the flag the
	 * showing writes is the same flag that keeps it from coming back. Held instead, nothing is
	 * spent while the handover is in flight and the reloaded page offers the dialog normally.
	 *
	 * The hold is taken *before* the sign-in, not at the reload. Every step in between can have
	 * the account context ready to accept a run — the organization list is written down long
	 * before the reload — and the reload itself is only reached once the login has finished, so a
	 * hold taken there would arrive after the dialog it is meant to keep off the screen.
	 *
	 * Never released on the way out: a successful sign-in always reloads, and the reload takes
	 * this module — holds and all — with it. The failure path is the one that gives it back, so a
	 * login that does not end in a reload cannot leave the feature locked out for the session.
	 */
	| "account-context-switch"

/** Announced on every change of the answer, so a mounted surface can follow it rather than poll. */
export const HOME_ONBOARDING_PRELUDE_EVENT = "magic-home-onboarding-prelude"

/** The holds currently up. Empty is the normal case, and the only one the onboarding runs in. */
const heldDialogs = new Set<HomeOnboardingPreludeDialog>()

function announcePreludeChange() {
	if (typeof window === "undefined") return
	window.dispatchEvent(new Event(HOME_ONBOARDING_PRELUDE_EVENT))
}

/** This dialog is about to be on screen. Idempotent: holding twice is still one hold. */
export function holdHomeOnboardingPrelude(dialog: HomeOnboardingPreludeDialog) {
	if (heldDialogs.has(dialog)) return
	heldDialogs.add(dialog)
	announcePreludeChange()
}

/** This dialog is gone. Releasing one that was never held changes nothing. */
export function releaseHomeOnboardingPrelude(dialog: HomeOnboardingPreludeDialog) {
	if (!heldDialogs.delete(dialog)) return
	announcePreludeChange()
}

/**
 * Whether something ahead of the onboarding holds the screen right now — a dialog that is up, or a
 * claim whose own dialog has not been decided yet. Read before mounting anything the onboarding
 * would show, so a held surface is never rendered and never asks the backend for a list it is about
 * to hide again.
 */
export function isHomeOnboardingPreludeHeld(): boolean {
	return heldDialogs.size > 0
}

/**
 * The answer above, followed. A dialog can be dismissed long after the page that waits behind it has
 * mounted — a claim answered after the first paint shows its own dialog then — so a surface gated on
 * this has to open when the hold is released rather than decide once on mount.
 */
export function useHomeOnboardingPreludeHeld(): boolean {
	const [held, setHeld] = useState(isHomeOnboardingPreludeHeld)

	useEffect(() => {
		const sync = () => setHeld(isHomeOnboardingPreludeHeld())
		// Read once as well as listen: a hold can be taken between this component's render and its
		// effect, and `useState` above only saw the answer as of that render.
		sync()
		window.addEventListener(HOME_ONBOARDING_PRELUDE_EVENT, sync)
		return () => window.removeEventListener(HOME_ONBOARDING_PRELUDE_EVENT, sync)
	}, [])

	return held
}
