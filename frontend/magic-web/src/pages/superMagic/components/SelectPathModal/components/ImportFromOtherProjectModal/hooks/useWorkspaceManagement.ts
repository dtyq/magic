import { useState, useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import type { TFunction } from "i18next"
import { SuperMagicApi } from "@/apis"
import type { Workspace } from "../../../../../pages/Workspace/types"
import { SHARE_WORKSPACE_ID, MY_CLAW_WORKSPACE_ID } from "../../../../../constants"

interface UseWorkspaceManagementOptions {
	workspaces: Workspace[]
	t: TFunction<"super", undefined>
}

export function useWorkspaceManagement(options: UseWorkspaceManagementOptions) {
	const { workspaces: initialWorkspaces, t } = options

	const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
	const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>(initialWorkspaces)

	const getWorkspaceDisplayName = useMemoizedFn((workspace: Workspace) => {
		if (workspace.id === SHARE_WORKSPACE_ID) {
			return t("workspace.shareWorkspaceName")
		}
		if (workspace.id === MY_CLAW_WORKSPACE_ID) {
			return t("workspace.myClawWorkspaceName")
		}
		return workspace.name || t("workspace.unnamedWorkspace")
	})

	const refreshWorkspaces = useMemoizedFn(async () => {
		try {
			const res = await SuperMagicApi.getWorkspaces({
				page: 1,
				page_size: 999,
			})
			const refreshedWorkspaces = res?.list || []
			setAvailableWorkspaces(refreshedWorkspaces)
			return refreshedWorkspaces
		} catch (error) {
			console.error("Failed to refresh workspaces:", error)
			return []
		}
	})

	const selectWorkspace = useCallback((workspace: Workspace) => {
		setCurrentWorkspace(workspace)
	}, [])

	const clearWorkspace = useCallback(() => {
		setCurrentWorkspace(null)
	}, [])

	return {
		currentWorkspace,
		availableWorkspaces,
		getWorkspaceDisplayName,
		refreshWorkspaces,
		selectWorkspace,
		clearWorkspace,
		setAvailableWorkspaces,
	}
}
