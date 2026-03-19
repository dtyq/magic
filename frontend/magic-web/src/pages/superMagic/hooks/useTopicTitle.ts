import { useEffect } from "react"
import { reaction } from "mobx"
import { projectStore, workspaceStore } from "../stores/core"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"
import { useTranslation } from "react-i18next"
import { ProjectListItem, Workspace } from "../pages/Workspace/types"

/**
 * Hook to sync topic name to page title
 * @param setMeta - Function to set page meta data
 */
export function useProjectTitle() {
	const { setMeta } = useMetaSet()
	const { t } = useTranslation("super")

	useEffect(() => {
		return reaction(
			() =>
				[workspaceStore.selectedWorkspace, projectStore.selectedProject] as [
					Workspace,
					ProjectListItem,
				],
			([avaiableWorkspace, avaiableProject]) => {
				// 设置元信息
				setMeta({
					title: `${avaiableProject
							? `${avaiableProject?.project_name || t("project.unnamedProject")} - `
							: ""
						}${avaiableWorkspace?.name || t("workspace.unnamedWorkspace")}`,
				})
			},
		)
	}, [setMeta, t])
}
