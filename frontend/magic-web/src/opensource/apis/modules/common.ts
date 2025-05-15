import { genRequestUrl } from "@/utils/http"
import { RequestUrl } from "../constant"
import type { Common } from "@/types/common"
import { env } from "@/utils/env"
import type { HttpClient } from "@/opensource/apis/core/HttpClient"

export const generateCommonApi = (fetch: HttpClient) => ({
	/**
	 * 获取应用国际化语言、国际冠号等配置(开源版本本地获取)
	 * @returns
	 */
	getInternationalizedSettings() {
		return {
			phone_area_codes: [
				{
					code: "+86",
					name: "中国",
					locale: "zh_CN",
					translations: {
						zh_CN: "中国",
						en_US: "China",
					},
				},
				{
					code: "+60",
					name: "马来西亚",
					locale: "ms_MY",
					translations: {
						zh_CN: "马来西亚",
						en_US: "Malaysia",
					},
				},
				{
					code: "+84",
					name: "越南",
					locale: "vi_VN",
					translations: {
						zh_CN: "越南",
						en_US: "Vietnam",
					},
				},
				{
					code: "+66",
					name: "泰国",
					locale: "th_TH",
					translations: {
						zh_CN: "泰国",
						en_US: "Thailand",
					},
				},
				{
					code: "+63",
					name: "菲律宾",
					locale: "fil_PH",
					translations: {
						zh_CN: "菲律宾",
						en_US: "Philippines",
					},
				},
				{
					code: "+65",
					name: "新加坡",
					locale: "en_SG",
					translations: {
						zh_CN: "新加坡",
						en_US: "Singapore",
					},
				},
			],
			languages: [
				{
					name: "简体中文",
					locale: "zh_CN",
					translations: {
						zh_CN: "简体中文",
						en_US: "Simplified Chinese",
					},
				},
				{
					name: "英文",
					locale: "en_US",
					translations: {
						zh_CN: "英文",
						en_US: "English",
					},
				},
			],
		}
	},

	/**
	 * @description 获取私有化登录环境配置
	 * @param {string} code 私有化部署授权码
	 */
	async getPrivateConfigure(code: string): Promise<{ config: Common.PrivateConfig }> {
		// 当且仅当 code 为空或不存在则返回当前 magic 部署环境的对应相同环境下 teamshare、keewood 配置
		if (!code || code === "") {
			return {
				config: {
					deployCode: "",
					services: {
						keewoodAPI: {
							url: env("MAGIC_SERVICE_KEEWOOD_BASE_URL", true) as string,
						},
						teamshareAPI: {
							url: env("MAGIC_TEAMSHARE_WEB_URL", true) as string,
						},
						teamshareWeb: {
							url: env("MAGIC_SERVICE_TEAMSHARE_BASE_URL", true) as string,
						},
						keewoodWeb: {
							url: env("MAGIC_KEEWOOD_WEB_URL", true) as string,
						},
					},
				},
			}
		}
		return fetch.post<{ config: Common.PrivateConfig }>(
			env("MAGIC_SERVICE_KEEWOOD_BASE_URL", true) +
				genRequestUrl(RequestUrl.getPrivateConfigure),
			{ identifier: code || "" },
		)
	},
})
