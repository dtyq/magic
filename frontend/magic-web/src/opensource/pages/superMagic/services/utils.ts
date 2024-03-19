import { userStore } from "@/opensource/models/user"
import { INIT_DOMAINS } from "@/opensource/models/user/stores/initialization.store"
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
	// Check if user is already initialized
	const isInitialized = userStore.initialization.isInitialized({
		magicId: userStore.user.userInfo?.magic_id,
		organizationCode: userStore.user.userInfo?.organization_code,
		domain: INIT_DOMAINS.super,
	})

	if (isInitialized) return

	const hasRouteParams = !!(workspaceId || projectId || topicId)

	// Mobile with route params: use refresh to keep cached data
	if (isMobile && hasRouteParams) {
		SuperMagicService.refreshState({
			workspaceId: workspaceId || undefined,
			projectId,
			topicId,
		})
	} else {
		// Desktop or mobile without workspace: full initialization
		SuperMagicService.initializeState({
			workspaceId: workspaceId || undefined,
			projectId,
			topicId,
		})
	}

	// 标记为已初始化
	userStore.initialization.markInitialized({
		magicId: userStore.user.userInfo?.magic_id,
		organizationCode: userStore.user.userInfo?.organization_code,
		domain: INIT_DOMAINS.super,
	})
}
