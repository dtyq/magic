import { useMemo, useState } from "react"
import { useMemoizedFn, useMount } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"

export function useWorkspace() {
	const { t } = useTranslation("super")
	const [workspaces, setWorkspaces] = useState<Workspace[]>([])

	const fetchWorkspaces = useMemoizedFn(async () => {
		try {
			const response = await SuperMagicApi.getWorkspaces({ page: 1, page_size: 99 })
			if (!response?.list) return

			setWorkspaces([
				...response.list,
				{
					id: SHARE_WORKSPACE_ID,
					name: t("workspace.teamSharedWorkspace"),
				},
			])
		} catch (error) {
			console.error("获取工作区列表失败:", error)
			magicToast.error(t("workspace.fetchWorkspacesFailed"))
		}
	})

	const workspaceOptions = useMemo(() => {
		return workspaces.map((workspace) => ({
			...workspace,
			label: workspace.name || t("workspace.unnamedWorkspace"),
			value: workspace.id,
		}))
	}, [workspaces, t])

	const handleAddWorkspace = useMemoizedFn(async (workspaceName: string) => {
		try {
			const response = await SuperMagicApi.createWorkspace({
				workspace_name: workspaceName || "",
			})

			if (response?.id) {
				await fetchWorkspaces()
				return response
			}
		} catch (error) {
			console.log("创建工作区失败，失败原因：", error)
		}
	})

	useMount(() => {
		fetchWorkspaces()
	})

	return {
		workspaces,
		workspaceOptions,
		fetchWorkspaces,
		handleAddWorkspace,
	}
}
