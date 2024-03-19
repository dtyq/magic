import type { User } from "@/opensource/types/user"
import type { VerificationCode } from "@/opensource/constants/bussiness"
import { genRequestUrl } from "@/opensource/utils/http"
import { isNil, isUndefined, omitBy } from "lodash-es"
import type { Login } from "@/opensource/types/login"
import { configStore } from "@/opensource/models/config"

import type { HttpClient, RequestConfig } from "../core/HttpClient"
import { Common } from "@/opensource/types/common"
import { env } from "@/opensource/utils/env"

export interface TeamshareUserInfo {
	id: string
	real_name: string
	avatar: string
	organization: string
	description: string
	nick_name: string
	phone: string
	is_remind_change_password: boolean
	platform_type: number
	is_organization_admin: boolean
	is_application_admin: boolean
	identifications: string[]
	shown_identification: null
	workbench_menu_config: {
		workbench: boolean
		application: boolean
		approval: boolean
		assignment: boolean
		cloud_storage: boolean
		knowledge_base: boolean
		message: boolean
		favorite: boolean
	}
	timezone: string
	is_perfect_password: boolean
	state_code: string
	departments: {
		name: string
		level: number
		id: string
	}[][]
}

export const generateUserApi = (fetch: HttpClient) => ({
	/**
	 * @description 登录
	 * @param {Login.LoginType} type 登录类型
	 * @param {Login.SMSVerificationCodeFormValues | Login.MobilePhonePasswordFormValues} values 登录表单
	 * @returns
	 */
	login(
		type: Login.LoginType,
		values: Login.SMSVerificationCodeFormValues | Login.MobilePhonePasswordFormValues,
	) {
		return fetch.post<Login.UserLoginsResponse>(
			"/api/v1/sessions",
			{
				...values,
				type,
			},
			{ enableRequestUnion: true, enableAuthorization: false },
		)
	},

	/**
	 * @description 发送邮箱验证码
	 * @param {Login.LoginType} email 邮箱
	 * @param {string} type account_login 用户登录 register_account 用户注册 change_password 修改密码
	 * @returns
	 */
	sendEmailVerificationCode(email: string, type: string, token: string) {
		return fetch.post<Login.UserLoginsResponse>(
			genRequestUrl("/v4/user/send-email"),
			{ email, type },
			{
				enableRequestUnion: true,
				enableAuthorization: false,
				headers: {
					["X-Captcha-Token"]: token || "",
				},
			},
		)
	},
	/**
	 * @description 邮箱登录
	 * @param {Login.LoginType} type 登录类型
	 * @param {Login.EmailVerificationCodeFormValues} values 登录表单
	 * @returns
	 */
	loginByEmail(values: Login.EmailVerificationCodeFormValues) {
		return fetch.post<Login.UserLoginsResponse>(genRequestUrl("/v4/user/login-email"), values, {
			enableRequestUnion: true,
			enableAuthorization: false,
		})
	},

	/**
	 * @description 登出
	 * @param {{ device: Common.DeviceInfo }} data 登录设备
	 * @param {HeadersInit} headers 请求头
	 * @param signal
	 * @returns
	 */
	logout(data: { device: Common.DeviceInfo }, headers?: HeadersInit, signal?: AbortSignal) {
		return fetch.post<Login.UserLoginsResponse>(genRequestUrl("/v4/users/logout"), data, {
			headers,
			signal,
			enableRequestUnion: true,
			enableAuthorizationVerification: false,
		})
	},

	/**
	 * @description 钉钉 App 登录
	 * @param {Login.DingTalkAppLoginFormValues} values 登录表单
	 * @returns
	 */
	dingtalkAppLogin(values: Login.DingTalkAppLoginFormValues) {
		return fetch.post<Login.UserLoginsResponse>(genRequestUrl("/v4/user/magic/login"), values, {
			enableRequestUnion: true,
			enableAuthorization: false,
		})
	},

	/**
	 * @description 第三方登录（钉钉登录、企业微信登录、飞书登录）
	 * @param {Login.ThirdPartyLoginsFormValues | Login.WechatOfficialAccountLoginsFormValues} values 登录表单
	 */
	thirdPartyLogins(
		values: Login.ThirdPartyLoginsFormValues | Login.WechatOfficialAccountLoginsFormValues,
		options?: Omit<RequestConfig, "url" | "body">,
	) {
		return fetch.post<Login.UserLoginsResponse>(genRequestUrl("/v4/user/fast_login"), values, {
			enableErrorMessagePrompt: false,
			enableRequestUnion: true,
			enableAuthorization: false,
			...options,
		})
	},

	/**
	 * 获取用户设备
	 * @returns
	 */
	getUserDevices() {
		return fetch.get<User.UserDeviceInfo[]>(genRequestUrl("/v4/users/login/devices"))
	},

	/**
	 * 获取用户信息
	 * @returns
	 */
	getUserInfo() {
		return fetch.get<User.UserInfo>(genRequestUrl("/v4/users/info"))
	},

	/**
	 * 获取用户账户
	 * @param {Record<string, string>} headers 请求头，由业务层决定携带哪个账号的请求头获取组织
	 * @param {string} deployCode 私有化部署Code，由业务层决定请求哪个服务
	 */
	getUserOrganizations(headers?: Record<string, string>, deployCode?: string) {
		const { clusterConfig } = configStore.cluster
		const url =
			(!isNil(deployCode) ? clusterConfig?.[deployCode]?.services?.keewoodAPI?.url : "") || ""

		return fetch.get<User.UserOrganization[]>(url + genRequestUrl("/v4/users/organizations"), {
			headers: headers ?? {},
			enableRequestUnion: true,
		})
	},

	/**
	 * 登出某台设备
	 * @param code
	 * @param id
	 * @returns
	 */
	logoutDevices(code: string, id: string) {
		return fetch.post(genRequestUrl("/v4/users/logout/device"), { code, id })
	},

	/**
	 * 获取用户某种类型验证码
	 * @param type
	 * @param phone
	 * @returns
	 */
	getUsersVerificationCode(type: VerificationCode, phone?: string) {
		return fetch.post(
			genRequestUrl("/v4/users/send_sms"),
			omitBy({ type, phone }, isUndefined),
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * 获取修改手机号验证码
	 * @param type
	 * @param phone
	 * @param state_code
	 * @returns
	 */
	getPhoneVerificationCode(
		type: VerificationCode,
		phone?: string,
		state_code?: string,
		token?: string,
	) {
		return fetch.post(
			genRequestUrl("/v4/user/send-sms"),
			omitBy({ type, phone, state_code }, isUndefined),
			{
				enableRequestUnion: true,
				enableAuthorization: false,
				headers: {
					["X-Captcha-Token"]: token || "",
				},
			},
		)
	},

	/**
	 * 修改密码
	 * @param code
	 * @param new_password
	 * @param repeat_new_password
	 * @returns
	 */
	changePassword(code: string, new_password: string, repeat_new_password: string) {
		return fetch.put(genRequestUrl("/v4/users/pwd"), {
			code,
			new_password,
			repeat_new_password,
		})
	},

	/**
	 * 修改手机号
	 * @param code
	 * @param new_phone
	 * @param new_phone_code
	 * @param state_code
	 * @returns
	 */
	changePhone(code: string, new_phone: string, new_phone_code: string, state_code: string) {
		return fetch.put(genRequestUrl("/v4/users/phone"), {
			code,
			new_phone,
			new_phone_code,
			state_code,
		})
	},

	/**
	 * 获取天书用户信息
	 * @returns
	 */
	getTeamshareUserInfo() {
		return fetch.get<TeamshareUserInfo>(genRequestUrl("/v4/users/info"))
	},

	/**
	 * @description 获取公众号登录二维码
	 * @returns {Promise<{scene_value: string; ticket: string; expire_seconds: number; url: string}>}
	 */
	getWechatQrcodeTicket(signal: AbortSignal) {
		return fetch.get<{
			scene_value: string
			ticket: string
			expire_seconds: number
			url: string
		}>(env("MAGIC_SERVICE_KEEWOOD_BASE_URL", true) + genRequestUrl("/v4/user/wechat/qrcode"), {
			signal,
			enableRequestUnion: true,
			enableAuthorization: false,
		})
	},

	/**
	 * @description 获取公众号登录二维码扫码状态
	 * @param {string} sceneValue 场景值
	 * @param {AbortSignal} signal 请求控制器
	 * @returns {Promise<{status: string}>}
	 */
	getWechatLoginStatus(sceneValue: string, signal: AbortSignal) {
		return fetch.get<{
			status: string
		}>(genRequestUrl("/v4/user/wechat/login/status", {}, { scene_value: sceneValue }), {
			signal,
			enableErrorMessagePrompt: false,
			enableRequestUnion: true,
			enableAuthorization: false,
		})
	},

	/**
	 * @description 发送手机验证码
	 * @param {object} params
	 * @param {string} params.type 验证码类型，如 account_login_bind_third_platform
	 * @param {string} params.phone 手机号
	 * @param {string} params.state_code 国家代码，如 +86
	 */
	sendSmsCode(params: { type: string; phone: string; state_code: string }) {
		return fetch.post(genRequestUrl("/v4/user/send_sms"), params, {
			enableAuthorization: false,
		})
	},

	/**
	 * @description 公众号绑定手机号
	 * @param {object} params
	 * @param {string} params.phone 手机号
	 * @param {string} params.platform_type 平台类型，固定为 wechat_official_account
	 * @param {string} params.code 手机验证码
	 * @param {string} params.unionid 场景值
	 * @param {string} params.state_code 国家代码，如 +86
	 * @param {Common.DeviceInfo} params.device 设备信息
	 * @returns {Promise<Login.UserLoginsResponse>}
	 */
	wechatBindAccount(params: {
		phone: string
		platform_type: string
		code: string
		unionid: string
		state_code: string
		device: Common.DeviceInfo
	}) {
		return fetch.post<Login.UserLoginsResponse>(
			genRequestUrl("/v4/user/bind_account"),
			params,
			{
				enableErrorMessagePrompt: false,
				enableRequestUnion: true,
				enableAuthorization: false,
			},
		)
	},

	/**
	 * @description 修改用户信息
	 * @param {object} params 用户信息参数
	 * @param {string} params.avatar_url 头像路径
	 * @param {string} params.nickname 用户名
	 * @returns {Promise<any>}
	 */
	updateUserInfo(params: { avatar_url: string; nickname: string }) {
		return fetch.patch(genRequestUrl("/api/v1/contact/users/me"), params)
	},

	/**
	 * @description 是否允许修改用户信息
	 * @returns {Promise<{ permission: boolean }>}
	 */
	getUserUpdatePermission() {
		return fetch.get<{ permission: boolean }>(
			genRequestUrl("/api/v1/contact/users/me/update-permission"),
		)
	},

	/**
	 * 获取图片验证码信息
	 * @returns
	 */
	getImageCaptcha(data: Login.ImageCaptchaParams) {
		return fetch.post<Login.ImageCaptchaResponse>("/captcha/generate", data, {
			enableAuthorization: false,
		})
	},

	/**
	 * 验证图片验证码
	 * @returns
	 */
	verifyImageCaptcha(data: Login.VerifyImageCaptchaParams) {
		return fetch.post<Login.VerifyImageCaptchaResponse>("/captcha/verify", data, {
			enableAuthorization: false,
		})
	},
})
