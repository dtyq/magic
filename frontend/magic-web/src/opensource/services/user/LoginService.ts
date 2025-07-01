/* eslint-disable class-methods-use-this */
import type { LoginFormValuesMap, LoginStepResult } from "@/opensource/pages/login/types"
import { Login } from "@/types/login"
import type { User } from "@/types/user"
import { getDeviceInfo } from "@/utils/devices"
import { keyBy } from "lodash-es"
import { userTransformer } from "@/opensource/models/user/transformers"
import type * as apis from "@/opensource/apis"
import type { Container } from "@/opensource/services/ServiceContainer"
import type { VerificationCode } from "@/const/bussiness"
import { userStore } from "@/opensource/models/user/stores"
import { configStore } from "@/opensource/models/config"
import type { ConfigService } from "../config/ConfigService"
import type { UserService } from "./UserService"

export class LoginService {
	protected userApi: (typeof apis)["UserApi"]

	protected authApi: (typeof apis)["AuthApi"]

	protected commonApi: (typeof apis)["CommonApi"]

	protected readonly service: Container

	constructor(dependencies: typeof apis, service: Container) {
		this.userApi = dependencies.UserApi
		this.authApi = dependencies.AuthApi
		this.commonApi = dependencies.CommonApi
		this.service = service
	}

	/**
	 * @description 统一登录
	 */
	loginStep = <T extends Login.LoginType>(type: T, values: LoginFormValuesMap[T]) => {
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
					return this.userApi.thirdPartyLogins(values as Login.ThirdPartyLoginsFormValues)
				default:
					throw new Error("缺少登录类型")
			}
		}
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
		await this.service.get<ConfigService>("configService").setClusterConfig(code, config)
		return Promise.resolve(config)
	}

	/** Step 2: 根据环境同步 magic 组织 */
	magicOrganizationSyncStep = (clusterCode: string) => {
		return async (
			params: Login.UserLoginsResponse,
			teamshareOrganizationCode?: string,
		): Promise<Omit<LoginStepResult, "organizationCode">> => {
			try {
				const { access_token } = params
				const result = await this.authApi.bindMagicAuthorization(
					access_token,
					clusterCode,
					teamshareOrganizationCode,
				)
				const magicOrganizationMap = keyBy(result, "magic_organization_code")
				return { access_token, magicOrganizationMap }
			} catch (error: any) {
				const newMessage = `magicOrganizationSyncStep: ${error.message}`
				const newError = new Error(newMessage)
				newError.stack = error?.stack
				window.console.error(error)
				return Promise.reject(error)
			}
		}
	}

	/** Step 4: 账号同步(判断当前) */
	accountSyncStep = (deployCode: string) => {
		return async (params: LoginStepResult): Promise<string> => {
			try {
				const {
					access_token,
					magicOrganizationMap,
					organizations,
					teamshareOrganizationCode,
				} = params
				
				const magicOrgs = Object.values(magicOrganizationMap)
				
				const orgCode =
					teamshareOrganizationCode ?? magicOrgs?.[0]?.third_platform_organization_code
				
				const magicOrg = keyBy(Object.values(magicOrganizationMap), "third_platform_organization_code")
				
				if (orgCode) {
					const userInfo = await this.service
						.get<UserService>("userService")
						.fetchUserInfo(magicOrg?.[orgCode]?.magic_user_id)
					if (userInfo) {
						// 登录完成后构造用户信息，维护在账号体系中
						const userAccount: User.UserAccount = {
							deployCode,
							nickname: userInfo?.nickname,
							organizationCode: userInfo?.organization_code,
							avatar: userInfo?.avatar_url,
							magic_id: userInfo?.magic_id,
							magic_user_id: userInfo?.user_id,
							access_token,
							teamshareOrganizations: organizations ?? [],
							organizations: magicOrgs,
						}
						this.service
							.get<UserService>("userService")
							.setUserInfo(userTransformer(userInfo))
						this.service.get<UserService>("userService").setAccount(userAccount)
					}
				}

				return access_token
			} catch (error: any) {
				const newMessage = `accountSyncStep: ${error.message}`
				const newError = new Error(newMessage)
				newError.stack = error?.stack
				return Promise.reject(error)
			}
		}
	}

	/** 账号 Token 同步 */
	authorizationSyncStep = (userInfo: Login.UserLoginsResponse) => {
		this.service.get<UserService>("userService").setAuthorization(userInfo.access_token)
		return Promise.resolve(userInfo)
	}

	/** Teamshare 生态组织获取 */
	organizationFetchStep = async (
		params: Omit<LoginStepResult, "organizationCode">,
	): Promise<LoginStepResult> => {
		try {
			const { access_token, magicOrganizationMap } = params

			// 获取 teamshare 当前账号下所有组织
			// const organizations = await this.userApi.getUserOrganizations(
			// 	{authorization: access_token},
			// 	deployCode,
			// )
			// debugger
			// const teamshareOrgsCode = organizations.map((o) => o.organization_code)
			//
			// // 获取到 teamshare 的组织后，需要针对上步 magicOrganizationMap 进行合法性过滤(因后端没处理 magicOrganizationMap 数据的合法性，所以这里需要根据 teamshare 中不存在的组织过滤 magicOrganizationMap)
			// const magicOrganizationArray = Object.values(allMagicOrganizationMap).filter((o) =>
			// 	teamshareOrgsCode.includes(o.third_platform_organization_code),
			// )
			// const magicOrganizationMap = keyBy(
			// 	magicOrganizationArray,
			// 	"third_platform_organization_code",
			// )
			// const teamshareOrgMap = keyBy(magicOrganizationArray, "magic_organization_code")

			// const authorizedOrgsCode = Object.keys(magicOrganizationMap) // 已授权组织
			// const authorizedOrg = organizations.find((org) =>
			// 	authorizedOrgsCode.includes(org.organization_code),
			// )

			// magicOrganizationCode 处理 (优先判断缓存是否存在)
			const magicOrgCodeCache = userStore.user?.organizationCode
			// let magicOrgCode = null
			// if (magicOrgCodeCache && teamshareOrgMap?.[magicOrgCodeCache]) {
			// 	// 当且仅当缓存中的 magicOrgCode 存在且在当前账号中有效则使用缓存
			// 	magicOrgCode = magicOrgCodeCache
			// } else {
			// 	// 当且仅当 magic 组织 Code 不存在的情况下，重新以第一个作为首选
			// 	magicOrgCode =
			// 		magicOrganizationMap?.[authorizedOrg?.organization_code ?? ""]
			// 			?.magic_organization_code
			// }

			return {
				access_token,
				magicOrganizationMap,
				organizations: [],
				organizationCode:
					magicOrgCodeCache ||
					Object.values(magicOrganizationMap)?.[0]?.magic_organization_code,
			}
		} catch (error: any) {
			const newMessage = `organizationFetchStep: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			return Promise.reject(error)
		}
	}

	/** Teamshare 生态组织同步 */
	organizationSyncStep = async (params: LoginStepResult) => {
		const { organizationCode, teamshareOrganizationCode, organizations, magicOrganizationMap } =
			params

		this.service.get<UserService>("userService").setOrganization({
			organizationCode,
			teamshareOrganizationCode,
			organizations,
			magicOrganizationMap,
		})
		return Promise.resolve(params)
	}

	/** Step 6: 用户信息同步(magic体系的唯一用户Id) */
	fetchUserInfoStep = async (unionId: string) => {
		try {
			const userInfo = await this.service
				.get<UserService>("userService")
				.fetchUserInfo(unionId)
			if (userInfo) {
				this.service.get<UserService>("userService").setUserInfo(userTransformer(userInfo))
			}
			return userInfo
		} catch (error: any) {
			const newMessage = `fetchUserInfoStep: ${error.message}`
			const newError = new Error(newMessage)
			newError.stack = error?.stack
			return Promise.reject(error)
		}
	}

	/** 获取用户手机号码 */
	getPhoneVerificationCode = async (
		type: VerificationCode,
		phone: string,
		stateCode?: string,
	) => {
		return this.userApi.getPhoneVerificationCode(type, phone, stateCode)
	}

	/** 获取用户手机号码 */
	getUsersVerificationCode = async (type: VerificationCode, phone: string) => {
		return this.userApi.getUsersVerificationCode(type, phone)
	}
}
