import { useEffect } from "react"
import { matchPath, useLocation } from "react-router"
import { reaction } from "mobx"
import type { TFunction } from "i18next"
import { RoutePath } from "@/constants/routes"
import { projectStore, workspaceStore } from "../stores/core"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"
import { useTranslation } from "react-i18next"
import { ProjectListItem, Workspace } from "../pages/Workspace/types"
import { isCachedChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"

interface ResolveSuperPageDocumentTitleOptions {
	project: ProjectListItem | null | undefined
	workspace: Workspace | null | undefined
	isChatRoute: boolean
	t: TFunction<"super">
}

/** Returns true when pathname matches the dedicated Super chat conversation route. */
export function isSuperChatProjectRoute(pathname: string) {
	return matchPath(`/:clusterCode${RoutePath.SuperChatProjectState}`, pathname) != null
}

/**
 * Builds the page title segment before the site suffix (`{segment} - {site}`).
 * Chat conversations use conversation name only; other Super pages include workspace.
 */
export function resolveSuperPageDocumentTitle({
	project,
	workspace,
	isChatRoute,
	t,
}: ResolveSuperPageDocumentTitleOptions) {
	const isChatConversation = isChatRoute || isCachedChatWorkspaceProject(project)

	if (isChatConversation) {
		return project?.project_name?.trim() || t("chat.unnamedChat")
	}

	const projectPart = project ? `${project.project_name || t("project.unnamedProject")} - ` : ""

	return `${projectPart}${workspace?.name || t("workspace.unnamedWorkspace")}`
}

/**
 * Syncs MobX project/workspace selection (and chat route) to document.title via setMeta.
 */
export function useProjectTitle() {
	const { pathname } = useLocation()
	const { setMeta } = useMetaSet()
	const { t } = useTranslation("super")

	useEffect(() => {
		return reaction(
			() =>
				[
					workspaceStore.selectedWorkspace,
					projectStore.selectedProject,
					isSuperChatProjectRoute(pathname),
				] as const,
			([avaiableWorkspace, avaiableProject, isChatRoute]) => {
				setMeta({
					title: resolveSuperPageDocumentTitle({
						project: avaiableProject,
						workspace: avaiableWorkspace,
						isChatRoute,
						t,
					}),
				})
			},
			{ fireImmediately: true },
		)
	}, [pathname, setMeta, t])
}
