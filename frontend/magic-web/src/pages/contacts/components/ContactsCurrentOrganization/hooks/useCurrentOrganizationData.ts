import { useState } from "react"
import { useMount } from "ahooks"
import { userStore } from "@/models/user"
import userInfoService from "@/services/userInfo"
import { StructureUserItem } from "@/types/organization"
import type { UseCurrentOrganizationDataReturn } from "../types"
import { pathNodesStore } from "../../../stores/core"

/**
 * useCurrentOrganizationData - Hook for managing current organization data logic
 * Now uses pathNodesStore for caching with Stale-While-Revalidate strategy
 *
 * @returns Object containing user info, loading state, and processed path nodes
 */
export function useCurrentOrganizationData(): UseCurrentOrganizationDataReturn {
	const [userInfo, setUserInfo] = useState<StructureUserItem | null>(null)

	// Fetch user info on mount and initialize store
	useMount(() => {
		if (!userStore.user.userInfo?.user_id) return

		// Load user info for backward compatibility
		userInfoService
			.fetchUserInfos([userStore.user.userInfo?.user_id], 2)
			.then((res: StructureUserItem[]) => {
				setUserInfo(res[0])
			})

		// Initialize path nodes from store (uses cache if available, then silent update)
		pathNodesStore.initialize()
	})

	// Return observable data from MobX store
	return {
		userInfo,
		isLoading: pathNodesStore.isLoading,
		pathNodesState: pathNodesStore.pathNodes,
	}
}
