import { useTranslation } from "react-i18next"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import {
	WorkspaceStatus,
	type ProjectListItem,
	type Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import {
	MY_AGENTS_WORKSPACE_DATA,
	MY_CLAW_WORKSPACE_DATA,
	MY_MICRO_APPS_WORKSPACE_DATA,
	MY_SKILLS_WORKSPACE_DATA,
	SHARE_WORKSPACE_DATA,
	SHARE_WORKSPACE_ID,
} from "@/pages/superMagic/constants"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { isOwner } from "@/pages/superMagic/utils/permission"
import { isAiCanvasProject } from "@/pages/superMagic/utils/isAiCanvasProject"

/** 跨工作区列表的动作使用项目本身的归属；共享项目不暴露对方私人目录。 */
export default function useProjectWorkspace(project: ProjectListItem) {
	const { t } = useTranslation("super")
	const owner = isOwner(project.user_role)
	const specialWorkspace = owner
		? project.project_mode === TopicMode.MagiClaw
			? MY_CLAW_WORKSPACE_DATA(t)
			: project.project_mode === TopicMode.AgentCreator ||
				  project.project_mode === TopicMode.CustomAgent
				? MY_AGENTS_WORKSPACE_DATA(t)
				: project.project_mode === TopicMode.SkillProjectCreator ||
					  project.project_mode === TopicMode.CustomSkill
					? MY_SKILLS_WORKSPACE_DATA(t)
					: project.project_mode === TopicMode.MicroApp
						? MY_MICRO_APPS_WORKSPACE_DATA(t)
						: null
		: null
	// 菜单使用快捷入口实际绑定的本方工作区；位置标签仍将他人项目显示为共享项目。
	const workspaceId = owner
		? specialWorkspace?.id || project.workspace_id
		: project.is_bind_workspace && project.bind_workspace_id
			? project.bind_workspace_id
			: SHARE_WORKSPACE_ID
	// The ai-canvas workspace is system-managed and hidden from workspace lists; it reads as its
	// sidebar entry, "AI canvas", wherever a project's location is shown.
	const aiCanvasWorkspaceName =
		owner && isAiCanvasProject(project) ? t("sidebar:aiCanvas.title") : null
	const listedWorkspace = workspaceStore.getWorkspaceById(workspaceId)
	const workspace: Workspace = specialWorkspace
		? specialWorkspace
		: workspaceId === SHARE_WORKSPACE_ID
			? SHARE_WORKSPACE_DATA(t)
			: listedWorkspace
				? aiCanvasWorkspaceName
					? { ...listedWorkspace, name: aiCanvasWorkspaceName }
					: listedWorkspace
				: {
						id: workspaceId,
						name:
							aiCanvasWorkspaceName ??
							(owner ? project.workspace_name : t("workspace.unnamedWorkspace")),
						workspace_type: "default",
						is_archived: 0,
						workspace_status: WorkspaceStatus.WAITING,
						project_count: 0,
						current_project_id: project.id,
						current_topic_id: project.current_topic_id ?? "",
					}

	return {
		workspace,
		locationName: owner
			? workspace.name || t("workspace.unnamedWorkspace")
			: t("workspace.shareWorkspaceName"),
	}
}
