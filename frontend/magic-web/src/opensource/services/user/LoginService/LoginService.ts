/* eslint-disable @typescript-eslint/no-unused-vars */

import type { LoginFormValuesMap, LoginStepResult } from "@/opensource/pages/login/types"
import { Login } from "@/opensource/types/login"
import type { User } from "@/opensource/types/user"
import { getDeviceInfo } from "@/opensource/utils/devices"
import { keyBy } from "lodash-es"
import type * as apis from "@/opensource/apis"
import type { Container } from "@/opensource/services/ServiceContainer"
import type { VerificationCode } from "@/opensource/constants/bussiness"
import { userStore } from "@/opensource/models/user/stores"
import { configStore } from "@/opensource/models/config"
import type { ConfigService } from "../../config/ConfigService"
import type { UserService } from "../UserService"
import type { Common } from "@/opensource/types/common"
import { AccountService } from "../AccountService"
import magicClient from "@/opensource/apis/clients/magic"
import { userTransformer } from "@/opensource/models/user/transformers"

export class LoginService {
	protected userApi: (typeof apis)["UserApi"]

	protected authApi: (typeof apis)["AuthApi"]

	protected commonApi: (typeof apis)["CommonApi"]

	protected contactApi: (typeof apis)["ContactApi"]

	protected readonly service: Container

	constructor(dependencies: typeof apis, service: Container) {
		this.userApi = dependencies.UserApi
		this.authApi = dependencies.AuthApi
		this.commonApi = dependencies.CommonApi
		this.contactApi = dependencies.ContactApi
		this.service = service
	}

	/**
	 * @description 统一登录 - 支持幂等调用
	 */
	loginStep = <T extends Login.LoginType>(
		type: T,
		values: LoginFormValuesMap[T],
		organizationCode?: string,
	) => {
		return async () => {
			values.device = await getDeviceInfo(configStore.i18n.i18n.instance)

			switch (type) {
				case Login.LoginType.MobilePhonePassword:
					return this.userApi.login(type, values as Login.MobilePhonePasswordFormValues)
				case Login.LoginType.SMSVerificationCode:
					return this.userApi.login(type, values as Login.SMSVerificationCodeFormValues)
				case Login.LoginType.DingTalkScanCode:
				case Login.LoginType.DingTalkAvoid:
				case Login.LoginType.LarkScanCode:
				case Login.LoginType.WecomScanCode:
				case Login.LoginType.WechatOfficialAccount:
				case Login.LoginType.WechatAppLogin:
					let orgCode = organizationCode

					const deployCode = configStore.cluster.clusterCode
					if (!orgCode && deployCode) {
						orgCode = configStore.cluster.clusterConfig[deployCode].orgcode
					}

					return this.userApi.thirdPartyLogins(
						values as Login.ThirdPartyLoginsFormValues,
						{
							headers: {
								"organization-code": orgCode || "",
							},
						},
					)
				case Login.LoginType.DingTalkAppLogin:
					return this.userApi.dingtalkAppLogin(values as Login.DingTalkAppLoginFormValues)
				default:
					throw new Error("缺少登录类型")
			}
		}
	}

	/**
	 * @description 统一登录 - 支持幂等调用
	 */
	login = async <T extends Login.LoginType>(
		type: T,
		values: LoginFormValuesMap[T],
		organizationCode?: string,
	) => {
		// PS: 改到在无组织下创建组织的时候再消费邀请码
		// values.invite_code = consumeInvitationCookie()
		switch (type) {
			case Login.LoginType.MobilePhonePassword:
				return this.userApi.login(type, values as Login.MobilePhonePasswordFormValues)
			case Login.LoginType.SMSVerificationCode:
				return this.userApi.login(type, values as Login.SMSVerificationCodeFormValues)
			case Login.LoginType.EmailVerificationCode:
				return this.userApi.loginByEmail(values as Login.EmailVerificationCodeFormValues)
			case Login.LoginType.DingTalkScanCode:
			case Login.LoginType.DingTalkAvoid:
			case Login.LoginType.LarkScanCode:
			case Login.LoginType.WecomScanCode:
			case Login.LoginType.WechatOfficialAccount:
			case Login.LoginType.WechatAppLogin:
			case Login.LoginType.Redirect:
				let orgCode = organizationCode

				const deployCode = configStore.cluster.clusterCode
				if (!orgCode && deployCode) {
					orgCode = configStore.cluster.clusterConfig[deployCode].orgcode
				}

				return this.userApi.thirdPartyLogins(values as Login.ThirdPartyLoginsFormValues, {
					headers: {
						"organization-code": orgCode || "",
					},
				})
			case Login.LoginType.DingTalkAppLogin:
				return this.userApi.dingtalkAppLogin(values as Login.DingTalkAppLoginFormValues)
			default:
				throw new Error("缺少登录类型")
		}
	}

	/** Logout */
	async logout() {
		const { authorization } = userStore.user
		await magicClient.abort(async () => {
			if (authorization) {
				const controller = new AbortController()
				const device = await getDeviceInfo(configStore.i18n.i18n.instance)
				const headers = new Headers()
				headers.set("authorization", authorization || "")
				await this.userApi.logout({ device }, headers, controller.signal)
			}
		})
	}

	/** 同步当前登录帐号的环境配置 */
	syncClusterConfig = async () => {
		try {
			const { login_code } = await this.authApi.getAccountDeployCode()
			const config = await this.getClusterConfig(login_code)
			return { clusterCode: login_code, clusterConfig: config }
		} catch (error: any) {
			const newMessage = `deployCodeSyncStep: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			return Promise.reject(error)
		}
	}

	/** 获取集群环境 */
	getClusterConfig = async (code: string) => {
		const { config } = await this.commonApi.getPrivateConfigure(code)
		// 获取集群配置后，更新集群配置
		await this.service.get<ConfigService>("configService").setClusterConfig(code || "", config)
		return Promise.resolve(config)
	}

	/**
	 * @description 同步magic 组织
	 */
	magicOrganizationSync = async (
		clusterCode: string,
		accessToken: string,
		thirdPlatformOrganizationCode?: string,
	) => {
		try {
			const result = await this.authApi.bindMagicAuthorization(
				accessToken,
				clusterCode,
				thirdPlatformOrganizationCode,
			)
			return keyBy(result, "magic_organization_code")
		} catch (error: any) {
			const newMessage = `magicOrganizationSyncStep: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			window.console.error(error)
			return Promise.reject(error)
		}
	}

	/** Step 4: 账号同步(判断当前) */
	accountSync = async (params: LoginStepResult & { deployCode: string }) => {
		try {
			const {
				deployCode,
				access_token,
				magicOrganizationMap,
				organizations,
				teamshareOrganizationCode,
			} = params

			const magicOrgs = Object.values(magicOrganizationMap)

			const orgCode =
				teamshareOrganizationCode || magicOrgs?.[0]?.third_platform_organization_code

			if (orgCode) {
				const userInfo = await this.service.get<UserService>("userService").fetchUserInfo()
				if (userInfo) {
					userStore.user.setUserInfo(userTransformer(userInfo))
					// 登录完成后构造用户信息，维护在账号体系中
					this.service.get<AccountService>("accountService").setAccount({
						deployCode,
						nickname: userInfo?.nickname,
						organizationCode: userInfo?.organization_code,
						avatar: userInfo?.avatar_url,
						magic_id: userInfo?.magic_id,
						magic_user_id: userInfo?.user_id,
						access_token,
						teamshareOrganizations: organizations || [],
						organizations: magicOrgs,
					})
				}
			}
		} catch (error: any) {
			const newMessage = `accountSyncStep: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			return Promise.reject(error)
		}
	}

	/** 判断当前用户是否有超级麦吉权限 */
	getSuperMagicPermission = (params?: { organizationCode?: string; clusterCode?: string }) => {
		return this.authApi.getSuperMagicPermission(params)
	}

	/**
	 * @description 聚合 API 处理 magic 的组织信息、用户信息
	 * @param accessToken
	 * @param deployCode
	 */
	getThirdPlatformOrganizations = async (
		accessToken: string,
		deployCode: string,
	): Promise<{
		magicOrganizationMap: Record<string, User.MagicOrganization>
		organizationCode: string
		thirdPlatformOrganizations: Array<User.UserOrganization>
		thirdPlatformOrganizationCode: string
	}> => {
		try {
			const auth_status = await this.authApi.bindMagicAuthorization(accessToken, deployCode)

			// 聚合magic、第三方平台等组织集合
			const magicOrganizationMap = keyBy(auth_status, "magic_organization_code")

			// magicOrganizationCode 处理 (优先判断缓存是否存在)
			const magicOrgCodeCache = userStore.user?.organizationCode
			let magicOrgCode: string | null = null

			// 麦吉组织判断优先
			if (magicOrgCodeCache && magicOrganizationMap[magicOrgCodeCache]) {
				// 当且仅当缓存中的 magicOrgCode 存在且在当前账号中有效则使用缓存
				magicOrgCode = magicOrgCodeCache
			} else {
				// 当且仅当 magic 组织 Code 不存在的情况下，重新以第一个作为首选
				magicOrgCode = auth_status?.[0]?.magic_organization_code ?? null
			}

			return {
				magicOrganizationMap,
				organizationCode: magicOrgCode,
				thirdPlatformOrganizations: [],
				thirdPlatformOrganizationCode: "",
			}
		} catch (error: any) {
			const newMessage = `getThirdPlatformOrganizations: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			return Promise.reject(error)
		}
	}

	/**
	 * @description 第三方生态获取组织
	 * @param {Record<string, User.MagicOrganization>} magicOrganizationMap 麦吉组织Map
	 * @param _accessToken
	 * @param _deployCode
	 */
	getThirdPlatformOrganization = async (
		magicOrganizationMap: Record<string, User.MagicOrganization>,
		_accessToken: string,
		_deployCode?: string,
	): Promise<{
		organizations: Array<User.UserOrganization>
		organizationCode: string
		thirdPlatformOrganizationCode: string
	}> => {
		try {
			// magicOrganizationCode 处理 (优先判断缓存是否存在)
			const magicOrgCodeCache = userStore.user?.organizationCode

			return {
				organizations: [],
				organizationCode:
					magicOrgCodeCache ||
					Object.values(magicOrganizationMap)?.[0]?.magic_organization_code,
				thirdPlatformOrganizationCode: "",
			}
		} catch (error: any) {
			const newMessage = `organizationFetch: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			return Promise.reject(error)
		}
	}

	/** Obtain the verification code for modifying the phone number */
	getPhoneVerificationCode = async (
		type: VerificationCode,
		phone: string,
		stateCode?: string,
		token?: string,
	) => {
		return this.userApi.getPhoneVerificationCode(type, phone, stateCode, token)
	}

	/** Obtain the user's mobile phone number */
	getUsersVerificationCode = async (type: VerificationCode, phone: string) => {
		return this.userApi.getUsersVerificationCode(type, phone)
	}

	/**
	 * @description 私有化部署中第三方平台登录
	 * @param _platformType
	 * @param _organizationCode
	 */
	async thirdPartyPrivateLogin(
		_platformType: string,
		_organizationCode: string,
	): Promise<Common.PrivateConfigSignInValues> {
		return {} as Common.PrivateConfigSignInValues
	}

	/**
	 * @description Obtain WeChat QR code login credentials
	 */
	async getWechatQrcodeTicket(signal: AbortSignal) {
		return this.userApi.getWechatQrcodeTicket(signal)
	}

	/**
	 * @description Get WeChat QR code scanning status
	 * @param sceneValue
	 * @param signal
	 */
	async getWechatLoginStatus(sceneValue: string, signal: AbortSignal) {
		return this.userApi.getWechatLoginStatus(sceneValue, signal)
	}

	/**
	 * @description Scan the QR code on WeChat to bind an account
	 */
	async wechatBindAccount(params: {
		phone: string
		platform_type: string
		code: string
		unionid: string
		state_code: string
		device: Common.DeviceInfo
	}) {
		return this.userApi.wechatBindAccount(params)
	}

	sendEmailVerificationCode(email: string, type: string, token: string) {
		return this.userApi.sendEmailVerificationCode(email, type, token)
	}

	getImageCaptcha(data: Login.ImageCaptchaParams) {
		return this.userApi.getImageCaptcha(data)
	}

	verifyImageCaptcha(data: Login.VerifyImageCaptchaParams) {
		return this.userApi.verifyImageCaptcha(data)
	}
}
