import { useState } from "react"
import { sidebarStore } from "@/stores/layout/SidebarStore"

interface UseProjectCreateProps {
	workspaceId: string
	isExpanded: boolean
}

interface UseProjectCreateReturn {
	isCreatingProject: boolean
	handleCreateProject: (e: React.MouseEvent<HTMLDivElement>) => void
	handleCancelCreate: () => void
	handleProjectCreated: () => void
}

/**
 * Hook for managing project creation state and handlers
 */
export function useProjectCreate({
	workspaceId,
	isExpanded,
}: UseProjectCreateProps): UseProjectCreateReturn {
	const [isCreatingProject, setIsCreatingProject] = useState(false)

	function handleCreateProject(e: React.MouseEvent<HTMLDivElement>) {
		e.stopPropagation()
		setIsCreatingProject(true)
		// Ensure workspace is expanded when creating a project
		if (!isExpanded) {
			sidebarStore.setWorkspaceExpanded(workspaceId, true)
		}
	}

	function handleCancelCreate() {
		setIsCreatingProject(false)
	}

	function handleProjectCreated() {
		setIsCreatingProject(false)
	}

	return {
		isCreatingProject,
		handleCreateProject,
		handleCancelCreate,
		handleProjectCreated,
	}
}
