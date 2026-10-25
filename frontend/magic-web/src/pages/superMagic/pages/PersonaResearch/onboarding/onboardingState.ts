import { platformKey } from "@/utils/storage"

/**
 * Onboarding for the AI research pages. It is deliberately separate from the new-user benefits
 * tour (`LazyGuideTour`): that one is tied to backend reward tasks and only runs for personal
 * organizations, while research is mostly used by teams. Elements opt in with the same
 * `data-guide-anchor` attribute the rest of the app uses, so the markup stays one convention.
 */
export const ResearchOnboardingAnchor = {
	HomeComposer: "research-home-composer",
	HomeSettings: "research-home-settings",
	HomeTemplates: "research-home-templates",
	HomePersonaLibrary: "research-home-persona-library",
	HomeStudies: "research-home-studies",
	StudioProgress: "research-studio-progress",
	StudioTabs: "research-studio-tabs",
	StudioValidation: "research-studio-validation",
	StudioConversation: "research-studio-conversation",
	StudioRespondents: "research-studio-respondents",
	StudioShare: "research-studio-share",
} as const

export type ResearchOnboardingAnchorName =
	(typeof ResearchOnboardingAnchor)[keyof typeof ResearchOnboardingAnchor]

/** One tour per page: the research home and the study workspace. */
export type ResearchOnboardingPage = "home" | "studio"

/** Bump when the steps change enough that everyone should see the tour again. */
const ONBOARDING_VERSION = 1

export function researchOnboardingSeenKey(page: ResearchOnboardingPage, userId: string) {
	return platformKey(`persona-research-onboarding:${page}:v${ONBOARDING_VERSION}:${userId}`)
}

/**
 * Seen state is a per-browser convenience: there is no backend record for it, and showing the
 * tour once more on a new device is harmless. Storage that throws (private mode) counts as seen,
 * so a broken storage never replays the tour on every visit.
 */
export function hasSeenResearchOnboarding(page: ResearchOnboardingPage, userId: string) {
	try {
		return localStorage.getItem(researchOnboardingSeenKey(page, userId)) !== null
	} catch {
		return true
	}
}

/** Finishing and skipping both count as seen. */
export function markResearchOnboardingSeen(page: ResearchOnboardingPage, userId: string) {
	try {
		localStorage.setItem(researchOnboardingSeenKey(page, userId), String(Date.now()))
	} catch {
		// Nothing to persist to; the tour simply may show again next time.
	}
}

const REPLAY_EVENT = "persona-research-onboarding-replay"

/** Asks the tour mounted on `page` to play again (the help dialog's replay button). */
export function requestResearchOnboarding(page: ResearchOnboardingPage) {
	window.dispatchEvent(new CustomEvent<ResearchOnboardingPage>(REPLAY_EVENT, { detail: page }))
}

export function subscribeResearchOnboardingReplay(
	page: ResearchOnboardingPage,
	listener: () => void,
) {
	const handle = (event: Event) => {
		if ((event as CustomEvent<ResearchOnboardingPage>).detail === page) listener()
	}
	window.addEventListener(REPLAY_EVENT, handle)
	return () => window.removeEventListener(REPLAY_EVENT, handle)
}

/** The visible element carrying an anchor, or null when the page does not render it right now. */
export function findResearchOnboardingAnchor(anchor: string): HTMLElement | null {
	const element = document.querySelector<HTMLElement>(`[data-guide-anchor="${anchor}"]`)
	if (!element) return null
	const rect = element.getBoundingClientRect()
	// Hidden by a breakpoint (`hidden lg:flex`) or a collapsed panel: nothing to point at.
	return rect.width > 0 && rect.height > 0 ? element : null
}
