import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"

export const FUNCTION_PERMISSION_CODE = {
	SkillCreate: "skill.create",
	SkillPublish: "skill.publish_team",
	/** Platform Skill market management (official Skill import). */
	SkillMarketManage: "platform.skill.market.edit",
	AgentCreate: "agent.create",
	AgentPublish: "agent.publish_team",
	MagicClawAccess: "magic_claw.access",
	MagicClawCreate: "magic_claw.create",
	MicroAppSharePublic: "micro_app.share_public",
	MicroAppSharePassword: "micro_app.share_password",
	MicroAppShareTeam: "micro_app.share_team",
	ProjectSharePublic: "project.share_public",
	ProjectSharePassword: "project.share_password",
	ProjectShareTeam: "project.share_team",
	/** Topic shares are governed on their own, and have no team share method. */
	TopicSharePublic: "topic.share_public",
	TopicSharePassword: "topic.share_password",
} as const

/** Platform-level permission group used by super administrators. */
export const PLATFORM_SUPER_ADMIN_PERMISSION_KEY = "MAGIC_PLATFORM_PERMISSIONS"

export type FunctionPermissionCode =
	(typeof FUNCTION_PERMISSION_CODE)[keyof typeof FUNCTION_PERMISSION_CODE]

export type FunctionPermissionMap = Partial<Record<FunctionPermissionCode, boolean>>

export interface PermissionGroupsResponse {
	permission_key: string[]
}

export const generateFunctionPermissionApi = (fetch: ServiceHttpClient) => ({
	getMe() {
		return fetch.get<FunctionPermissionMap>("/api/v1/function-permissions/me")
	},
	getPermissionGroups() {
		return fetch.get<PermissionGroupsResponse>("/api/v1/permissions/me")
	},
})
