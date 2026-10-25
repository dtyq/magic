import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"

export type MicroAppPublishShareType = 2 | 4 | 5
export type MicroAppPublishShareRange = "all" | "designated"
export type MicroAppListScope = "all" | "created" | "collaborated" | "accessible" | "recent"

export interface MicroAppShareExtra {
	pure_mode?: boolean
}

export interface MicroAppPublishTarget {
	target_type: "User" | "Department"
	target_id: string
}

export interface PublishMicroAppProjectBody {
	app_name: string
	share_type: MicroAppPublishShareType
	share_range?: MicroAppPublishShareRange
	target_ids?: MicroAppPublishTarget[]
	password?: string
	cover_file_key?: string | null
	expire_days?: number | null
	default_open_file_id?: string | null
	extra?: MicroAppShareExtra
}

export interface PublishedMicroAppProjectItem {
	app_id?: string
	project_id?: string
	app_name?: string
	project_name?: string
	resource_id?: string
	share_id?: string
	share_code?: string
	share_type: MicroAppPublishShareType
	share_range?: MicroAppPublishShareRange
	target_ids?: MicroAppPublishTarget[]
	access_url?: string
	published_at?: string
	password?: string
	cover_file_key?: string | null
	expire_days?: number | null
	expire_at?: string | null
	default_open_file_id?: string | null
	cover_url?: string
	extra?: MicroAppShareExtra
	publish_status?: "published" | "unpublished" | string
}

export interface MicroAppListItem {
	app_id: string
	/** Project id used by collaboration APIs when the list contract provides it. */
	project_id?: string
	app_name: string
	app_description: string
	creator_id: string
	cover_url: string
	publish_status: "published" | "unpublished" | string
	updated_at: string | null
	/** Current user's effective role in the underlying project. */
	user_role?: CollaboratorPermission
}

export interface MicroAppListResponse {
	list: MicroAppListItem[]
	total: number
	page: number
	page_size: number
}

export interface UpdateMicroAppBody {
	app_name?: string
	cover_file_key?: string | null
}

export interface MicroAppMetadata {
	app_id: string
	app_name: string
	cover_file_key?: string | null
	cover_url?: string
	publish_status?: "published" | "unpublished" | string
	updated_at?: string | null
}

export interface DeleteMicroAppResponse {
	app_id: string
	project_id: string
	deleted: boolean
}

export interface PublishedMicroAppProjectRecord {
	project?: {
		id?: string | number
		workspace_id?: string | number
		project_name?: string
		project_description?: string
		project_mode?: string
		current_topic_id?: string | number
		current_topic_status?: string
		created_at?: string
		updated_at?: string
	}
	publish?: PublishedMicroAppProjectItem
}

export interface PublishedMicroAppProjectsResponse {
	list: Array<PublishedMicroAppProjectItem | PublishedMicroAppProjectRecord>
	total?: number
	page?: number
	page_size?: number
}

export interface MicroAppProjectDetail {
	app_id: string
	project_id: string
	organization_code: string
	project?: ProjectListItem
	publish?: PublishedMicroAppProjectItem
}

export interface CreateMicroAppProjectResponse {
	app_id: string
	project: ProjectListItem
	topic: Topic
}

export type MicroAppRuntimeProject = Pick<ProjectListItem, "id"> &
	Partial<Omit<ProjectListItem, "id" | "user_role">> &
	Pick<ProjectListItem, "user_role">

export interface MicroAppRuntimeProjectResponse {
	exists: boolean
	project: MicroAppRuntimeProject | null
}

export interface EnsureMicroAppRuntimeProjectResponse {
	project: MicroAppRuntimeProject
	is_existing: boolean
}

export interface ResolvedPublishedMicroApp {
	app_id: string
	resource_id: string
	share_code: string
	organization_code: string
	cover_url?: string
	default_open_file_id?: string | null
	extra?: MicroAppShareExtra
}

export const generateMicroAppApi = (fetch: ServiceHttpClient) => ({
	getMicroAppWorkspace() {
		return fetch.get<Workspace>("/api/v1/super-agent/workspaces/app/micro-app")
	},

	createMicroAppProject({
		workspace_id,
		project_name = "",
		dynamic_params,
	}: {
		workspace_id?: string
		project_name?: string
		dynamic_params?: Record<string, unknown>
	}) {
		return fetch.post<CreateMicroAppProjectResponse>(
			"/api/v1/super-agent/micro-app-projects",
			{
				workspace_id,
				project_name,
				dynamic_params: dynamic_params ?? {
					agent_mode: "micro-app",
					message_version: "v2",
				},
			},
			{ parseJsonLargeIntAsString: true },
		)
	},

	getMicroApps(
		params: {
			page?: number
			page_size?: number
			keyword?: string
			scope?: MicroAppListScope
		} = {},
	) {
		const { page = 1, page_size = 20, keyword = "", scope = "all" } = params
		return fetch.get<MicroAppListResponse>("/api/v1/super-agent/micro-apps/queries", {
			params: { page, page_size, keyword, scope },
			parseJsonLargeIntAsString: true,
		})
	},

	getMentionMicroApps(
		params: {
			page?: number
			page_size?: number
			keyword?: string
		} = {},
	) {
		const { page = 1, page_size = 100, keyword = "" } = params
		return fetch.get<MicroAppListResponse>("/api/v1/super-agent/micro-apps/mention", {
			params: { page, page_size, keyword },
			parseJsonLargeIntAsString: true,
		})
	},

	recordMicroAppVisit(appId: string) {
		return fetch.post<{ recorded: boolean }>(
			`/api/v1/super-agent/micro-apps/${appId}/visit`,
			undefined,
		)
	},

	updateMicroApp(appId: string, body: UpdateMicroAppBody) {
		return fetch.put<MicroAppMetadata>(`/api/v1/super-agent/micro-apps/${appId}`, body, {
			parseJsonLargeIntAsString: true,
		})
	},

	deleteMicroApp(appId: string) {
		return fetch.delete<DeleteMicroAppResponse>(
			`/api/v1/super-agent/micro-apps/${appId}`,
			undefined,
			{ parseJsonLargeIntAsString: true },
		)
	},

	getMicroAppProject(appId: string, options?: { enableErrorMessagePrompt?: boolean }) {
		return fetch.get<MicroAppProjectDetail>(`/api/v1/super-agent/micro-app-projects/${appId}`, {
			parseJsonLargeIntAsString: true,
			...options,
		})
	},

	getMicroAppProjectByProjectId(projectId: string) {
		return fetch.get<MicroAppProjectDetail>(
			`/api/v1/super-agent/micro-app-projects/by-project/${projectId}`,
			{ parseJsonLargeIntAsString: true },
		)
	},

	getMicroAppRuntimeProject(appId: string, options?: { enableErrorMessagePrompt?: boolean }) {
		return fetch.get<MicroAppRuntimeProjectResponse>(
			`/api/v1/super-agent/micro-app-projects/${appId}/runtime-project`,
			{ parseJsonLargeIntAsString: true, ...options },
		)
	},

	ensureMicroAppRuntimeProject(appId: string) {
		return fetch.post<EnsureMicroAppRuntimeProjectResponse>(
			`/api/v1/super-agent/micro-app-projects/${appId}/runtime-project`,
			undefined,
			{ parseJsonLargeIntAsString: true },
		)
	},

	resolvePublishedMicroApp(appId: string) {
		return fetch.get<ResolvedPublishedMicroApp>(`/api/v1/share/micro-apps/${appId}`, {
			parseJsonLargeIntAsString: true,
		})
	},

	publishMicroAppProject(appId: string, body: PublishMicroAppProjectBody) {
		return fetch.post<PublishedMicroAppProjectItem>(
			`/api/v1/super-agent/micro-app-projects/${appId}/publish`,
			body,
			{ parseJsonLargeIntAsString: true },
		)
	},

	unpublishMicroAppProject(appId: string) {
		return fetch.delete<unknown>(`/api/v1/super-agent/micro-app-projects/${appId}/publish`)
	},

	getPublishedMicroAppProjects(
		params: {
			page?: number
			page_size?: number
			keyword?: string
		} = {},
	) {
		const { page = 1, page_size = 20, keyword = "" } = params
		return fetch.get<PublishedMicroAppProjectsResponse>(
			"/api/v1/super-agent/micro-app-projects/published/queries",
			{ params: { page, page_size, keyword }, parseJsonLargeIntAsString: true },
		)
	},
})
