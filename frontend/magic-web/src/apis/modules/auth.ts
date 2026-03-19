import { genRequestUrl } from "@/utils/http"
import type {
	AuthRequestParams,
	ResourceTypes,
} from "@/pages/flow/components/AuthControlButton/types"
import type { User } from "@/types/user"

import { isCommercial } from "@/utils/env"
import type { HttpClient } from "../core/HttpClient"
import { configStore } from "@/models/config"
import { isNil } from "lodash-es"

export const generateAuthApi = (fetch: HttpClient) => ({
	/** 更新资源授权 */
	updateResourceAccess(params: AuthRequestParams) {
		return fetch.post<null>(
			genRequestUrl("/api/v1/operation-permissions/resource-access"),
			params,
		)
	},

	/** 查询资源授权 */
	getResourceAccess(resource_type: ResourceTypes, resource_id: string) {
		return fetch.get<AuthRequestParams>(
			genRequestUrl(
				"/api/v1/operation-permissions/resource-access",
				{},
				{
					resource_type,
					resource_id,
				},
			),
		)
	},

	/**
	 * @description 获取所有登录后所需信息的聚合接口
	 * @param {string} authorization 用户token
	 * @param {string} authCode 登录授权码（私有化部署就有用，非私有化传空字符串）
	 */
	getUserProfile(authorization: string, authCode: string) {
		return fetch.get<{
			auth_status: Array<User.MagicOrganization>
			auth_environment: { third_platform_organization_code: string }
		}>(`/api/v1/aggregation/login-data?teamshare_login_code=${authCode}`, {
			headers: (h) => {
				h.set("authorization", authorization)
				// 组织 Code 可选，但传递后必须要正确，所以为了最大正确率移除组织 Code 使用
				h.delete("organization-code")
				return h
			},
			enableErrorMessagePrompt: false,
			enableRequestUnion: true,
		})
	},

	/**
	 * @description 登录后需要将 授权码 + authorization 在 magic service 进行绑定
	 * @param {string} authorization 用户token
	 * @param {string} authCode 登录授权码（私有化部署就有用，非私有化传空字符串）
	 * @param {string} thirdPlatformOrganizationCode 第一次创建组织时，返回的 第三方平台组织code，后端同步用户账号信息
	 */
	bindMagicAuthorization(
		authorization: string,
		authCode: string,
		thirdPlatformOrganizationCode?: string,
	) {
		return fetch.get<Array<User.MagicOrganization>>(
			genRequestUrl(
				"/api/v1/auth/status",
				{},
				{
					login_code: authCode || "",
				},
			),
			{
				headers: (h) => {
					const normalizedAuthorization = authorization?.trim()
					const normalizedOrganizationCode = thirdPlatformOrganizationCode?.trim()

					if (normalizedAuthorization) h.set("authorization", normalizedAuthorization)
					else h.delete("authorization")

					if (normalizedOrganizationCode)
						h.set("Organization-Code", normalizedOrganizationCode)
					else h.delete("Organization-Code")

					return h
				},
				enableErrorMessagePrompt: false,
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 获取当前账号所归属的环境 code
	 */
	getAccountDeployCode() {
		if (!isCommercial()) {
			return { login_code: "" }
		}
		return fetch.get<{ login_code: string }>(genRequestUrl("/api/v1/auth/environment"), {
			enableRequestUnion: true,
			headers: (h) => {
				h.delete("organization-code")
				return h
			},
		})
	},

	/**
	 * @description 用户 Token 换取一次性临时授权 Token
	 */
	getTempTokenFromUserToken() {
		return fetch.get<{ temp_token: string }>(genRequestUrl("/api/v1/auth/temp-token"))
	},

	/**
	 * @description 临时授权 Token 换取用户 Token
	 */
	getUserTokenFromTempToken(tempToken: string) {
		return fetch.get<{ teamshare_token: string }>(
			genRequestUrl("/api/v1/auth/teamshare-token?temp_token=${tempToken}", {
				tempToken,
			}),
			{
				enableRequestUnion: true,
				enableAuthorization: false,
			},
		)
	},

	/**
	 * @description 获取管理后台用户信息
	 * @returns {Promise<User.UserInfo>}
	 */
	getAdminPermission() {
		return fetch.get<{ is_admin: boolean }>(
			genRequestUrl("/api/v1/operation-permissions/organization-admin"),
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 判断当前用户是否有超级麦吉权限
	 */
	getSuperMagicPermission(params?: { organizationCode?: string; clusterCode?: string }) {
		const { clusterConfig } = configStore.cluster
		const url =
			(!isNil(params?.clusterCode)
				? clusterConfig?.[params?.clusterCode]?.services?.magicAPI?.url
				: "") || ""

		return fetch.get<{ should_redirect: boolean; enable_super_magic_display: boolean }>(
			url + genRequestUrl("/api/v1/super-agent/login/config"),
			{
				headers: {
					["Organization-Code"]: params?.organizationCode || "",
				},
				enableRequestUnion: true,
				enableErrorMessagePrompt: false,
			},
		)
	},
})
