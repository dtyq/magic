import type { MagicNavigateParams } from "@/routes/hooks/useNavigate"
import type { MobileTopicPageCapabilities } from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"
import {
	resolveSuperMobileProjectDetailBackFallback,
	type SuperMobileBackFallbackTarget,
} from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"

interface HandleProjectTopicBackParams {
	projectId?: string
	projectTopicCapabilities: MobileTopicPageCapabilities
	setSelectedTopic: (topic: null) => void
	navigate: (target: MagicNavigateParams) => void
}

/**
 * Handles back from a project topic page: clear topic binding, then history back or semantic parent.
 */
export function handleProjectTopicBackNavigation({
	projectId,
	projectTopicCapabilities,
	setSelectedTopic,
	navigate,
}: HandleProjectTopicBackParams): boolean {
	if (!projectId) return false

	// Clear topic so project entry does not resume the exited conversation.
	setSelectedTopic(null)
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
}

/**
 * Prefer route history back; when no in-app history, push the given semantic parent route.
 */
export function navigateSuperMobileBack({ navigate, fallback }: NavigateSuperMobileBackParams) {
	navigate({
		delta: -1,
		name: fallback.name,
		params: fallback.params,
		viewTransition: false,
	})
}

export { resolveSuperMobileProjectDetailBackFallback }
