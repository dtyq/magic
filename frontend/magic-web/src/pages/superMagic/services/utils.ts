import { userStore } from "@/models/user"
import { INIT_DOMAINS } from "@/models/user/stores/initialization.store"
import workspaceStore from "../stores/core/workspace"
import SuperMagicService from "./index"

interface InitializeSuperMagicParams {
	isMobile: boolean
	workspaceId?: string
	projectId?: string
	topicId?: string
}

/**
 * Initialize or refresh SuperMagic state if user not yet initialized
 */
export function initializeSuperMagicIfNeeded({
	isMobile,
	workspaceId,
	projectId,
	topicId,
}: InitializeSuperMagicParams) {
	const magicId = userStore.user.userInfo?.magic_id
	const organizationCode = userStore.user.userInfo?.organization_code
	if (!magicId || !organizationCode) return

	// 如果已经初始化过，则直接返回
	if (
		userStore.initialization.isInitialized({
			magicId,
			organizationCode,
			domain: INIT_DOMAINS.super,
		})
	)
		return

	const hasRouteParams = !!(workspaceId || projectId || topicId)
	void userStore.initialization
		.runInitialization(
			{
				magicId,
				organizationCode,
				domain: INIT_DOMAINS.super,
			},
			async () => {
				// Reuse sidebar workspace state to avoid clearing it on route entry.
				if (isMobile && hasRouteParams) {
					await SuperMagicService.refreshState({
						workspaceId: workspaceId || undefined,
						projectId,
						topicId,
					})
					return
				}

				// Desktop or mobile without workspace: full initialization
				await SuperMagicService.initializeState({
					workspaceId: workspaceId || undefined,
					projectId,
					topicId,
				})
			},
		)
		.catch(() => {
			// Keep existing fire-and-forget behavior for callers.
		})
}
