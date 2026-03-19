import { useState, useEffect, useRef } from "react"
import type {
	Workspace,
	ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import { useMemoizedFn } from "ahooks"

interface NavigationState {
	level: "workspace" | "topic" | "project"
	currentWorkspace?: Workspace
	currentProject?: ProjectListItem
	hideBackButton?: boolean
}

interface UseNavigationStateParams {
	selectedProject?: ProjectListItem
	visible: boolean
}

export function useNavigationState({ selectedProject, visible }: UseNavigationStateParams) {
	const selectedWorkspace = workspaceStore.selectedWorkspace ?? undefined

	const [navigationState, setNavigationState] = useState<NavigationState>({
		level: "workspace",
	})

	const navigationStateRef = useRef(navigationState)
	navigationStateRef.current = navigationState

	const handleAutoNavigation = useMemoizedFn(() => {
		const current = navigationStateRef.current

		if (selectedWorkspace && selectedProject) {
			if (
				current.level === "project" &&
				current.currentWorkspace?.id === selectedWorkspace.id &&
				current.currentProject?.id === selectedProject.id
			)
				return

			setNavigationState({
				level: "project",
				currentWorkspace: selectedWorkspace,
				currentProject: selectedProject,
			})
		} else {
			if (
				current.level === "workspace" &&
				!current.currentWorkspace &&
				!current.currentProject
			)
				return

			setNavigationState({
				level: "workspace",
			})
		}
	})

	useEffect(() => {
		if (visible) {
			handleAutoNavigation()
		}
	}, [visible, handleAutoNavigation])

	const handleBackClick = useMemoizedFn(() => {
		const current = navigationStateRef.current
		if (current.level === "project") {
			setNavigationState({
				level: "workspace",
			})
		} else if (current.level === "topic") {
			setNavigationState({
				level: "project",
				currentWorkspace: current.currentWorkspace,
			})
		}
	})

	const navigateToProjects = useMemoizedFn(
		(workspace: Workspace, options?: { hideBackButton?: boolean }) => {
			setNavigationState({
				level: "project",
				currentWorkspace: workspace,
				hideBackButton: options?.hideBackButton,
			})
		},
	)

	return {
		navigationState,
		setNavigationState,
		handleAutoNavigation,
		handleBackClick,
		navigateToProjects,
	}
}
