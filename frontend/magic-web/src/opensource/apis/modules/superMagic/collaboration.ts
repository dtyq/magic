import type { HttpClient, RequestConfig } from "@/opensource/apis/core/HttpClient"
import { genRequestUrl } from "@/opensource/utils/http"
import { CollaboratorPermission } from "@/opensource/pages/superMagic/types/collaboration"
import {
	Collaborator,
	CollaborationJoinMethod,
	CollaborationProjectCreator,
	CollaborationProjectListItem,
	CollaborationProjectType,
	ProjectStatus,
	TopicMode,
	WithPage,
} from "@/opensource/pages/superMagic/pages/Workspace/types"

export interface CollaborationInfo {
	id: string
	workspace_id: string
	project_name: string
	project_description: string
	work_dir: string
	current_topic_id: string
	current_topic_status: ProjectStatus
	project_status: ProjectStatus
	project_mode: TopicMode
	workspace_name: string | null
	is_collaboration_enabled: boolean
	default_join_permission: CollaboratorPermission
	tag: string
	created_at: string
	updated_at: string
	user_id: string
}

/** 邀请链接数据结构 */
export interface InvitationLinkData {
	id: string
	project_id: string
	token: string
	is_enabled: boolean
	password?: string
	default_join_permission: CollaboratorPermission
	is_password_enabled: boolean
	created_by: string
	created_at: string
	updated_at: string
}

/** 通过Token获取的邀请信息 */
export interface InvitationInfo {
	project_id: string
	project_name: string
	project_description: string
	organization_code: string
	creator_id: string
	creator_name: string
	creator_avatar: string
	default_join_permission: CollaboratorPermission
	requires_password: boolean
	token: string
	has_joined: boolean
}

export const generateCollaborationApi = (fetch: HttpClient) => ({
	/**
	 * 获取项目协作信息
	 * @param projectId 项目ID
	 * @returns CollaborationInfo
	 */
	getCollaborationConfig(projectId: string) {
		return fetch.get<CollaborationInfo>(`/api/v1/super-agent/projects/${projectId}`)
	},

	/**
	 * 更新项目协作信息
	 * @param projectId 项目ID
	 * @param data 更新数据
	 * @returns CollaborationInfo
	 */
	updateCollaborationConfig(
		projectId: string,
		data: Partial<{
			is_collaboration_enabled: boolean
			default_join_permission: CollaboratorPermission
		}>,
	) {
		return fetch.put<CollaborationInfo>(`/api/v1/super-agent/projects/${projectId}`, data)
	},

	/**
	 * 开启/关闭邀请链接
	 * @param projectId 项目ID
	 * @param enabled 是否启用
	 */
	toggleInvitationLink(projectId: string, enabled: boolean) {
		return fetch.put<InvitationLinkData>(
			`/api/v1/super-agent/projects/${projectId}/invitation-links/toggle`,
			{ enabled },
		)
	},

	/**
	 * 获取项目邀请链接信息
	 * @param projectId 项目ID
	 */
	getInvitationLinkConfig(projectId: string) {
		return fetch.get<InvitationLinkData | null>(
			`/api/v1/super-agent/projects/${projectId}/invitation-links`,
		)
	},

	/**
	 * 邀请链接-重置邀请链接
	 * @param projectId 项目ID
	 */
	resetInvitationLink(projectId: string) {
		return fetch.post<InvitationLinkData>(
			`/api/v1/super-agent/projects/${projectId}/invitation-links/reset`,
			{},
		)
	},

	/**
	 * 邀请链接-设置密码保护
	 * @param projectId 项目ID
	 * @param password 密码
	 */
	setInvitationPassword(projectId: string, enabled: boolean) {
		return fetch.post<{ password: string }>(
			`/api/v1/super-agent/projects/${projectId}/invitation-links/password`,
			{ enabled },
		)
	},

	/**
	 * 邀请链接-重新设置密码
	 * @param projectId 项目ID
	 */
	resetInvitationPassword(projectId: string) {
		return fetch.post<{ password: string }>(
			`/api/v1/super-agent/projects/${projectId}/invitation-links/reset-password`,
		)
	},

	/**
	 * 邀请链接-修改权限级别
	 * @param projectId 项目ID
	 * @param permission 权限级别
	 */
	updateInvitationPermission(projectId: string, default_join_permission: CollaboratorPermission) {
		return fetch.put<InvitationLinkData>(
			`/api/v1/super-agent/projects/${projectId}/invitation-links/permission`,
			{ default_join_permission },
		)
	},

	/**
	 * 通过Token获取邀请信息
	 * @param token 邀请token
	 */
	getInvitationByToken(token: string) {
		return fetch.get<InvitationInfo>(`/api/v1/super-agent/invitation/links/${token}`)
	},

	/**
	 * 邀请链接-加入项目
	 * @param token 邀请token
	 * @param password 密码（可选）
	 */
	joinProjectByInvitation(token: string, password?: string) {
		return fetch.post<{
			project_id: string
			permission: CollaboratorPermission
		}>(`/api/v1/super-agent/invitation/join`, {
			token,
			password,
		})
	},

	/**
	 * 修改协作者权限
	 * @param projectId 项目ID
	 * @param collaboratorId 协作者ID
	 * @param permission 权限
	 */
	updateCollaboratorPermission(
		projectId: string,
		members: {
			target_type: "User" | "Department"
			target_id: string
			role: CollaboratorPermission
		}[],
	) {
		return fetch.put<unknown>(`/api/v1/super-agent/projects/${projectId}/members/roles`, {
			members,
		})
	},

	/**
	 * 获取项目协作者列表
	 * @param projectId 项目ID
	 * @returns Collaborator[]
	 */
	getCollaborators(projectId: string) {
		return fetch.get<{ members: Collaborator[] }>(
			`/api/v1/super-agent/projects/${projectId}/members`,
			{
				enableErrorMessagePrompt: false,
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * 移除协作者
	 * @param projectId 项目ID
	 * @param menbers 协作者列表
	 */
	removeCollaborators(
		projectId: string,
		members: { target_type: "User" | "Department"; target_id: string }[],
	) {
		return fetch.delete<unknown>(`/api/v1/super-agent/projects/${projectId}/members`, {
			members,
		})
	},

	/**
	 * 添加协作者
	 * @param projectId 项目ID
	 * @param members 协作者列表
	 */
	addCollaborators(
		projectId: string,
		members: {
			target_type: "User" | "Department"
			target_id: string
			role: CollaboratorPermission
		}[],
	) {
		return fetch.post<unknown>(`/api/v1/super-agent/projects/${projectId}/members`, { members })
	},

	/**
	 * 置顶协作项目
	 * @param projectId 项目ID
	 * @param data 数据
	 */
	updateCollaborationProjectPinStatus(projectId: string, data: { is_pin: boolean }) {
		return fetch.put(`/api/v1/super-agent/collaboration-projects/${projectId}/pin`, data)
	},

	/**
	 * 获取协作项目创建者
	 */
	getCollaborationProjectCreators() {
		return fetch.get<CollaborationProjectCreator[]>(
			genRequestUrl("/api/v1/super-agent/collaboration-projects/creators"),
		)
	},

	/**
	 * 更新协作项目快捷状态
	 * @param projectId 项目ID
	 * @param data 数据
	 */
	updateCollaborationProjectShortcutStatus(
		projectId: string,
		data: {
			workspace_id: string
			is_bind_workspace: 0 | 1
		},
	) {
		return fetch.put<{ success: boolean }>(
			`/api/v1/super-agent/collaboration-projects/${projectId}/shortcut`,
			data,
		)
	},

	/**
	 * 获取协作项目列表
	 * @param params 查询参数
	 */
	getCollaborationProjects(
		params: {
			page?: number
			page_size?: number
			name?: string
			type?: CollaborationProjectType
			sort_field?: "created_at" | "updated_at" | "last_active_at"
			sort_direction?: "asc" | "desc"
			creator_user_ids?: string[]
			join_method?: CollaborationJoinMethod
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.get<WithPage<CollaborationProjectListItem>>(
			genRequestUrl("/api/v1/super-agent/collaboration-projects", {}, params),
			options,
		)
	},

	/**
	 * 加入编辑
	 * @param fileId 文件ID
	 */
	joinFileEdit(fileId: string) {
		return fetch.post(`/api/v1/super-agent/file/${fileId}/join-editing`)
	},

	/**
	 * 离开编辑
	 * @param fileId 文件ID
	 */
	leaveFileEdit(fileId: string) {
		return fetch.post(`/api/v1/super-agent/file/${fileId}/leave-editing`)
	},

	/**
	 * 获取文件编辑人数
	 * @param fileId 文件ID
	 */
	getFileEditCount(fileId: string) {
		return fetch.get<{ editing_user_count: number }>(
			`/api/v1/super-agent/file/${fileId}/editing-users`,
		)
	},
})
