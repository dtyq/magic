import { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

export type UpdateUserInfoPermission = "nickname" | "avatar_url"

export const generateMagicUserApi = (fetch: HttpClient) => ({
	/**
	 * @description 修改用户信息
	 * @param {object} params 用户信息参数
	 * @param {string} params.avatar_url 头像路径
	 * @param {string} params.nickname 用户名
	 * @param {string} params.profession 职业身份
	 * @param {string} params.channel 获知渠道
	 * @returns {Promise<any>}
	 */
	updateUserInfo(params: {
		avatar_url?: string
		nickname?: string
		profession?: string
		channel?: string
	}) {
		return fetch.post(genRequestUrl("/api/v1/contact/users/me"), params)
	},

	/**
	 * @description 是否允许修改用户信息
	 * @returns {Promise<{ permission: boolean }>}
	 */
	getUserUpdatePermission() {
		return fetch.get<UpdateUserInfoPermission[]>(
			genRequestUrl("/api/v1/contact/users/me/update-permission"),
		)
	},
})
