import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useUserInfo } from "@/models/user/hooks"
import { useIsMobile } from "@/hooks/useIsMobile"
// The manager module only, not the LazyGuideTour barrel: the barrel pulls the tour's lazy chunk.
import { isHomeOnboardingRunBlocking } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import ResearchSpotlight, { type ResearchSpotlightOutcome } from "./ResearchSpotlight"
import {
	hasSeenResearchOnboarding,
	markResearchOnboardingSeen,
	subscribeResearchOnboardingReplay,
	type ResearchOnboardingPage,
} from "./onboardingState"
import { useResearchOnboardingSteps } from "./useResearchOnboardingSteps"

/**
 * Lets the page settle before the first anchor is measured: fonts, avatars, the stepper, and the
 * home page's staggered entrance (~0.9s of opacity/translateY). A transform does not trigger the
 * spotlight's resize tracking, so measuring mid-animation would leave the ring ~10px off. Without
 * motion there is no entrance to wait for.
 */
function autoOpenDelay() {
	const reducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	return reducedMotion ? 600 : 1000
}

interface ResearchOnboardingProps {
	page: ResearchOnboardingPage
	/** The page has rendered its real content (not a skeleton); anchors can be measured. */
	ready: boolean
	/**
	 * The page is busy with something the user should not be pulled away from — on the studio,
	 * the agent is running or waiting for an answer. The automatic first run waits until it is
	 * false again; a replay from the help dialog is not held back.
	 */
	deferred?: boolean
	/**
	 * Becomes true when the page needs the user's attention right now (an ask_user card has
	 * appeared). A tour that is up at that moment closes without being marked as seen, so it can
	 * play again later.
	 */
	interrupted?: boolean
	/** Runs after the last step's primary action, e.g. focusing the home composer. */
	onFinish?: () => void
}

/**
 * Plays the page's tour once per user and browser, and again whenever the help dialog asks.
 * Desktop only: the tour points at a desktop layout, and phones keep the help dialog.
 */
export default function ResearchOnboarding({
	page,
	ready,
	deferred = false,
	interrupted = false,
	onFinish,
}: ResearchOnboardingProps) {
	const isMobile = useIsMobile()
	const { userInfo } = useUserInfo()
	const userId = userInfo?.magic_id
	const [open, setOpen] = useState(false)
	const { steps, finishLabel } = useResearchOnboardingSteps(page)

	useEffect(() => {
		if (!ready || deferred || isMobile || !userId) return
		if (hasSeenResearchOnboarding(page, userId)) return
		const timer = window.setTimeout(() => {
			// Never stack on another overlay: the benefits tour, or a dialog the user opened in
			// the meantime. The tour simply waits for the next visit.
			if (isHomeOnboardingRunBlocking()) return
			if (document.querySelector('[role="dialog"][data-state="open"]')) return
			setOpen(true)
		}, autoOpenDelay())
		return () => window.clearTimeout(timer)
	}, [deferred, isMobile, page, ready, userId])

	useEffect(() => subscribeResearchOnboardingReplay(page, () => setOpen(true)), [page])

	// Only the moment the page starts needing the user ends a running tour: a replay the user
	// opened while a question was already waiting stays up until they close it.
	const wasInterrupted = useRef(interrupted)
	useEffect(() => {
		if (interrupted && !wasInterrupted.current) setOpen(false)
		wasInterrupted.current = interrupted
	}, [interrupted])

	const close = useMemoizedFn((outcome: ResearchSpotlightOutcome) => {
		setOpen(false)
		// A tour that found nothing to show has not been seen; let a later visit try again.
		if (userId && outcome !== "empty") markResearchOnboardingSeen(page, userId)
		// After the tour has unmounted: it hands focus back to where it was on the way out, and
		// the finish action (focusing the composer) must come after that, not be undone by it.
		if (outcome === "finished" && onFinish) window.setTimeout(onFinish)
	})

	if (!open || isMobile) return null
	return <ResearchSpotlight steps={steps} finishLabel={finishLabel} onClose={close} />
}
