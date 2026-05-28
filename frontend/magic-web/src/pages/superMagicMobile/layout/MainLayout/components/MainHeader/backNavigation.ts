import type { MagicNavigateParams } from "@/routes/hooks/useNavigate"
import type { MobileTopicPageCapabilities } from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"
import {
	resolveSuperMobileProjectDetailBackFallback,
	type SuperMobileBackFallbackTarget,
} from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"

/** Optional history.state payload for cross-navigation back to a list page. */
export interface SuperMobileNavigationState {
	returnTo?: SuperMobileBackFallbackTarget
}

/**
 * Reads returnTo from router location.state when entering detail via action sheet menus.
 */
export function readSuperMobileReturnTo(state: unknown): SuperMobileBackFallbackTarget | undefined {
	if (!state || typeof state !== "object") return undefined

	const returnTo = (state as SuperMobileNavigationState).returnTo
	if (!returnTo?.name) return undefined

	return returnTo
}

/**
 * Builds history.state for forward navigation that should return to a specific list route.
 */
export function buildSuperMobileNavigationState(
	returnTo: SuperMobileBackFallbackTarget,
): SuperMobileNavigationState {
	return { returnTo }
}

interface HandleProjectTopicBackParams {
	projectId?: string
	projectTopicCapabilities: MobileTopicPageCapabilities
	setSelectedTopic: (topic: null) => void
	navigate: (target: MagicNavigateParams) => void
	returnTo?: SuperMobileBackFallbackTarget
}

/**
 * Handles back from a project topic page: clear topic binding, then history back or semantic parent.
 */
export function handleProjectTopicBackNavigation({
	projectId,
	projectTopicCapabilities,
	setSelectedTopic,
	navigate,
	returnTo,
}: HandleProjectTopicBackParams): boolean {
	if (!projectId) return false

	// Clear topic so project entry does not resume the exited conversation.
	setSelectedTopic(null)

	if (returnTo) {
		navigateSuperMobileBack({ navigate, fallback: returnTo, returnTo })
		return true
	}

	const fallback = projectTopicCapabilities.resolveBackTarget(projectId)
	navigate({
		delta: -1,
		name: fallback.name,
		params: fallback.params,
		viewTransition: false,
	})

	return true
}

interface NavigateSuperMobileBackParams {
	navigate: (target: MagicNavigateParams) => void
	fallback: SuperMobileBackFallbackTarget
	returnTo?: SuperMobileBackFallbackTarget
}

/**
 * When returnTo is set (menu cross-navigation), replace to that list; otherwise history back or fallback.
 */
export function navigateSuperMobileBack({
	navigate,
	fallback,
	returnTo,
}: NavigateSuperMobileBackParams) {
	if (returnTo) {
		navigate({
			name: returnTo.name,
			params: returnTo.params,
			replace: true,
			viewTransition: false,
		})
		return
	}

	navigate({
		delta: -1,
		name: fallback.name,
		params: fallback.params,
		viewTransition: false,
	})
}

export { resolveSuperMobileProjectDetailBackFallback }
