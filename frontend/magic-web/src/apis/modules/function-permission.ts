import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

export const FUNCTION_PERMISSION_CODE = {
	SkillCreate: "skill.create",
	SkillPublish: "skill.publish_team",
	AgentCreate: "agent.create",
	AgentPublish: "agent.publish_team",
	MagicClawAccess: "magic_claw.access",
	MagicClawCreate: "magic_claw.create",
} as const

export type FunctionPermissionCode =
	(typeof FUNCTION_PERMISSION_CODE)[keyof typeof FUNCTION_PERMISSION_CODE]

export type FunctionPermissionMap = Partial<Record<FunctionPermissionCode, boolean>>

export const generateFunctionPermissionApi = (fetch: HttpClient) => ({
	getMe() {
		return fetch.get<FunctionPermissionMap>(genRequestUrl("/api/v1/function-permissions/me"))
	},
})
