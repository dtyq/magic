import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"

export type UpdateUserInfoPermission = "nickname" | "avatar_url"

export const generateMagicUserApi = (fetch: ServiceHttpClient) => ({
	/**
	 * @description 修改用户信息
	 * @param {object} params 用户信息参数
	 * @param {string} params.avatar_url 头像路径
	 * @param {string} params.nickname 用户名
	 * @param {string} params.profession 职业身份
	 * @param {string} params.channel 获知渠道
	 * @param {string} params.timezone 时区
	 * @returns {Promise<any>}
	 */
	updateUserInfo(params: {
		avatar_url?: string
		nickname?: string
		profession?: string
		channel?: string
		timezone?: string | null
		preferences?: {
			show_follow_up_suggestions?: boolean
			keep_used_follow_up_suggestions?: boolean
		}
	}) {
		return fetch.post("/api/v1/contact/users/me", params)
	},

	/**
	 * @description 是否允许修改用户信息
	 * @returns {Promise<{ permission: boolean }>}
	 */
	getUserUpdatePermission() {
		return fetch.get<UpdateUserInfoPermission[]>("/api/v1/contact/users/me/update-permission")
	},
})
