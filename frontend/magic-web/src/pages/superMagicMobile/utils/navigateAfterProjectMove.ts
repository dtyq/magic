import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { navigateSuperMobileBack } from "@/pages/superMagicMobile/layout/MainLayout/components/MainHeader/backNavigation"
import type { MagicNavigateParams } from "@/routes/hooks/useNavigate"
import type { SuperMobileBackFallbackTarget } from "./resolveSuperMobileBackFallback"
import { resolvePostMoveBackFallback } from "./resolveSuperMobileBackFallback"

export {
	shouldExitChatDetailAfterDelete,
	shouldExitDetailPageAfterDelete,
	shouldExitPageAfterProjectMove,
	shouldExitTopicDetailAfterDelete,
} from "./resolveSuperMobileBackFallback"

interface ApplySuperMobileDetailExitNavigationParams {
	navigate: (target: MagicNavigateParams) => void
	fallback: SuperMobileBackFallbackTarget | null
	/** When false, keep project selected (e.g. topic-only exit). Defaults to true. */
	clearProjectSelection?: boolean
	/**
	 * When true, replace to fallback immediately so detail routes unmount before store cleanup
	 * (avoids refreshState/getProjectDetail on deleted ids).
	 */
	leaveRouteImmediately?: boolean
}

/**
 * Clears selection and returns to the previous page with a semantic parent fallback.
 */
export function applySuperMobileDetailExitNavigation({
	navigate,
	fallback,
	clearProjectSelection = true,
	leaveRouteImmediately = false,
}: ApplySuperMobileDetailExitNavigationParams): void {
	if (leaveRouteImmediately && fallback) {
		navigate({
			name: fallback.name,
			params: fallback.params,
			replace: true,
			viewTransition: false,
		})
	}

	if (clearProjectSelection) {
		projectStore.setSelectedProject(null)
		topicStore.setTopics([])
	}
	topicStore.setSelectedTopic(null)

	if (!fallback || leaveRouteImmediately) return

	navigateSuperMobileBack({ navigate, fallback })
}

interface ApplyProjectDetailExitNavigationParams {
	workspaceId: string
	project: ProjectListItem
	navigate: (target: MagicNavigateParams) => void
}

/**
 * Clears project/topic context and returns to the previous page, falling back to the workspace project list.
 */
export async function applyProjectDetailExitNavigation({
	workspaceId,
	project,
	navigate,
}: ApplyProjectDetailExitNavigationParams): Promise<void> {
	const cachedWorkspace = workspaceStore.workspaces.find(
		(candidate) => candidate.id === workspaceId,
	)
	if (cachedWorkspace) {
		workspaceStore.setSelectedWorkspace(cachedWorkspace)
	} else {
		const workspace = await SuperMagicService.workspace
			.getWorkspaceDetail(workspaceId, { enableErrorMessagePrompt: false })
			.catch(() => null)
		if (workspace) {
			workspaceStore.setSelectedWorkspace(workspace)
		}
	}

	const fallback = resolvePostMoveBackFallback({
		targetWorkspaceId: workspaceId,
		movedProject: project,
	})
	applySuperMobileDetailExitNavigation({
		navigate,
		fallback,
		leaveRouteImmediately: true,
	})
}

/** @deprecated Use applyProjectDetailExitNavigation */
export const applyPostMoveExitNavigation = applyProjectDetailExitNavigation
