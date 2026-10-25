import { SuperMagicApi } from "@/apis"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { ResourceProject } from "../resourceProjectTypes"
import { ProjectStatus, type Workspace } from "@/pages/superMagic/pages/Workspace/types"

/** 微应用列表的 app_id 不是文件项目 ID；缺少 project_id 时先解析源码项目。 */
export async function loadMicroAppProjectPage({
	workspace,
	page,
	pageSize,
	keyword,
	signal,
}: {
	workspace: Workspace
	page: number
	pageSize: number
	keyword?: string
	signal?: AbortSignal
}): Promise<{ list: ResourceProject[]; total: number }> {
	signal?.throwIfAborted()
	const response = await SuperMagicApi.getMicroApps({
		page,
		page_size: pageSize,
		scope: "created",
		keyword,
	})
	signal?.throwIfAborted()
	const list = await Promise.all(
		response.list.map(async (app): Promise<ResourceProject> => {
			const detail = app.project_id
				? undefined
				: await SuperMagicApi.getMicroAppProject(app.app_id)
			signal?.throwIfAborted()
			const projectId = app.project_id || detail?.project_id
			return {
				project_status: ProjectStatus.WAITING,
				project_mode: TopicMode.MicroApp,
				workspace_id: workspace.id,
				workspace_name: workspace.name,
				work_dir: "",
				current_topic_id: "",
				current_topic_status: "",
				created_at: "",
				updated_at: app.updated_at || "",
				tag: "",
				user_role: app.user_role,
				...detail?.project,
				id: projectId || app.app_id,
				project_id: projectId || null,
				project_name: app.app_name,
				micro_app_id: app.app_id,
				resourceType: "micro-app",
				resourceId: app.app_id,
				resourceDescription: app.app_description,
				resourceCoverUrl: app.cover_url,
				resourceStatus: app.publish_status,
			}
		}),
	)
	return { list, total: response.total }
}
