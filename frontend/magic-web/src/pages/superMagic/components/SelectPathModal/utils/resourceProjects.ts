import { MagicClawApi } from "@/apis"
import { skillsService } from "@/services/skills/SkillsService"
import { crewService } from "@/services/crew/CrewService"
import {
	MY_CLAW_WORKSPACE_ID,
	MY_SKILLS_WORKSPACE_ID,
	MY_AGENTS_WORKSPACE_ID,
} from "../../../constants"
import { ProjectStatus, type Workspace } from "../../../pages/Workspace/types"
import { TopicMode } from "../../../pages/Workspace/TopicMode"
import type { ResourceProject } from "../resourceProjectTypes"
import { loadMicroAppProjectPage } from "./microAppProjects"
import { canEditProject } from "../../../utils/permission"

export type AgentResourceScope = "created" | "collaborated"

export function isResourceWorkspace(workspace: Workspace): boolean {
	return (
		workspace.workspace_type === "micro-app" ||
		[MY_CLAW_WORKSPACE_ID, MY_SKILLS_WORKSPACE_ID, MY_AGENTS_WORKSPACE_ID].includes(
			workspace.id,
		)
	)
}

/** 管理器和选择器共用资源身份、业务字段与服务端分页；资源 ID 不代替文件项目 ID。 */
export async function loadResourceProjectPage({
	workspace,
	page,
	pageSize,
	keyword,
	signal,
	agentScope = "created",
}: {
	workspace: Workspace
	page: number
	pageSize: number
	keyword?: string
	signal?: AbortSignal
	agentScope?: AgentResourceScope
}): Promise<{ list: ResourceProject[]; total: number }> {
	signal?.throwIfAborted()
	if (workspace.workspace_type === "micro-app")
		return loadMicroAppProjectPage({ workspace, page, pageSize, keyword, signal })
	const params = { page, page_size: pageSize, keyword }
	const base = {
		project_status: ProjectStatus.WAITING,
		workspace_id: workspace.id,
		workspace_name: workspace.name,
		work_dir: "",
		current_topic_id: "",
		current_topic_status: "",
		tag: "" as const,
	}
	if (workspace.id === MY_CLAW_WORKSPACE_ID) {
		const result = await MagicClawApi.queryMagicClawList(params, { signal })
		return {
			total: result.total,
			list: result.list.map((item): ResourceProject => ({
				...base,
				id: item.project_id || item.id,
				project_id: item.project_id || null,
				project_mode: TopicMode.MagiClaw,
				project_name: item.name,
				claw_code: item.code,
				resourceType: "claw",
				resourceId: item.id,
				resourceDescription: item.description,
				resourceIcon: item.icon_file_url,
				resourceStatus: item.status,
				resourceTemplateCode: item.template_code,
				resourceCode: item.code,
				created_at: item.created_at || "",
				updated_at: item.updated_at || "",
			})),
		}
	}
	if (workspace.id === MY_SKILLS_WORKSPACE_ID) {
		const result = await skillsService.getCreatedSkills(params)
		signal?.throwIfAborted()
		return {
			total: result.total,
			list: result.list.map((item): ResourceProject => ({
				...base,
				id: item.projectId || item.id,
				project_id: item.projectId || null,
				project_mode: TopicMode.SkillProjectCreator,
				project_name: item.name,
				resourceType: "skill",
				resourceId: item.id,
				resourceCode: item.skillCode,
				resourceDescription: item.description,
				resourceIcon: item.logo,
				resourceVersion: item.latestVersion,
				resourcePackageName: item.packageName,
				user_role: item.userRole,
				created_at: item.createdAt,
				updated_at: item.updatedAt,
			})),
		}
	}
	if (workspace.id !== MY_AGENTS_WORKSPACE_ID) throw new Error("Unsupported resource workspace")
	const result =
		agentScope === "collaborated"
			? await crewService.getCollaboratedAgents(params)
			: await crewService.getCreatedAgents(params)
	signal?.throwIfAborted()
	return {
		total: result.total,
		// 协作列表可能包含只读员工；沿用项目编辑权限，不扩大文件访问范围。
		list: result.list
			.filter((item) => agentScope === "created" || canEditProject(item.userRole))
			.map((item): ResourceProject => ({
				...base,
				id: item.projectId || item.id,
				project_id: item.projectId || null,
				project_mode: TopicMode.AgentCreator,
				project_name: item.name,
				resourceType: "agent",
				resourceId: item.id,
				resourceCode: item.agentCode,
				resourceDescription: item.description,
				resourceIcon: item.icon,
				resourceRole: item.role,
				resourceVersion: item.latestVersionCode,
				user_role: item.userRole,
				created_at: "",
				updated_at: item.updatedAt,
			})),
	}
}
