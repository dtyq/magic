import type { StructureUserItem } from "@/opensource/types/organization"
import type { User } from "@/opensource/types/user"
import { isEmpty, keyBy } from "lodash-es"
import type * as apis from "@/opensource/apis"
import type { Container } from "@/opensource/services/ServiceContainer"
import { userStore } from "@/opensource/models/user/stores"
import { userTransformer } from "@/opensource/models/user/transformers"
import { UserRepository } from "@/opensource/models/user/repositories/UserRepository"
import { AccountRepository } from "@/opensource/models/user/repositories/AccountRepository"
import type { AccountService } from "../AccountService"
import { AuthApi, ChatApi } from "@/opensource/apis"
import { logger as Logger } from "@/opensource/utils/log"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"
import { env, isDev } from "@/opensource/utils/env"
import { getNativePort } from "@/opensource/platform/native"

const logger = Logger.createLogger("UserService", {
	enableConfig: { console: !isDev },
})

export interface OrganizationResponse {
	magicOrganizationMap: Record<string, User.MagicOrganization>
	organizations?: Array<User.UserOrganization>
	/** magic 生态下的组织Code */
	organizationCode?: string
	/** teamshare 生态下的组织Code */
	teamshareOrganizationCode?: string
}

export class UserService {
	private readonly contactApi: typeof apis.ContactApi

	private readonly service: Container

	lastLogin: {
		authorization: string
		user_id: string
		promise: Promise<void>
	} | null = null

	constructor(dependencies: typeof apis, service: Container) {
		this.contactApi = dependencies.ContactApi
		this.service = service
	}

	/**
	 * @description 初始化(持久化数据/内存状态)
	 * 优化版：使用批量查询减少 IndexedDB 操作次数（从 7 次降至 2 次）
	 */
	async init() {
		const user = new UserRepository()
		const account = new AccountRepository()

		const [userData, accounts] = await Promise.all([
			user.getBatchUserData(),
			account.getAllAccounts(),
		])

		// 批量设置内存状态
		userStore.user.setAuthorization(userData.authorization)
		userStore.user.setUserInfo(userData.userInfo)
		userStore.user.setOrganizations(userData.organizations ?? {})
		userStore.user.setOrganizationCode(userData.organizationCode ?? "")
		userStore.user.setTeamshareOrganization(
			userData.teamshareOrganizationCode ?? "",
			userData.teamshareOrganizations ?? [],
		)

		accounts.forEach((a) => {
			if (!isEmpty(a)) {
				userStore.account.setAccount(a)
			}
		})
	}

	/**
	 * @description 用户登录态下，同步用户所在环境
	 */
	loadConfig = async () => {
		// const { authorization } = userStore.user
		// if (authorization) {
		// 	// Step 1: 检查授权码
		// 	const deployCode = await this.service.get<LoginService>("loginService").deployCodeSyncStep()
		// 	setClusterCode(deployCode)
		// 	logger.warn("withPrivateDeploy Step 1: 同步当前账号deployCode", deployCode)
		//
		// 	// Step 2: 获取环境配置
		// 	const config = await loginService.envSyncStep(deployCode)
		// 	logger.warn("withPrivateDeploy Step 2: 获取 deployConfig ", config)
		// }
	}

	/**
	 * @description 设置当前用户token（内存、数据持久化）
	 */
	setAuthorization(authorization: string | null) {
		// 设置内存状态、同步数据持久化
		const user = new UserRepository()
		user.setAuthorization(authorization ?? "")
		userStore.user.setAuthorization(authorization)
	}

	/**
	 * @description 获取当前组织下当前用户信息
	 */
	fetchUserInfo = async (): Promise<StructureUserItem | null> => {
		const userInfo = await this.contactApi.getAccountUserInfo()

		if (userInfo) {
			this.setUserInfo(userTransformer(userInfo))
		}

		return userInfo
	}

	/**
	 * @description 重新获取用户信息
	 */
	refreshUserInfo = async (): Promise<StructureUserItem | null> => {
		const user_id = userStore.user.userInfo?.user_id
		const magic_id = userStore.user.userInfo?.magic_id

		if (!user_id || !magic_id) {
			return null
		}
		const userInfoResponse = await this.contactApi.getAccountUserInfo()

		// 更新用户信息
		const user = new UserRepository()
		const userInfo = userTransformer(userInfoResponse)
		user.setUserInfo(userInfo)
		userStore.user.setUserInfo(userInfo)

		BroadcastChannelSender.updateUserInfo(userInfo)

		// 更新账号信息
		const account = new AccountRepository()

		const updateData = {
			avatar: userInfoResponse?.avatar_url,
			nickname: userInfoResponse?.nickname,
		}

		account.updateAccount(magic_id, updateData)
		userStore.account.updateAccount(magic_id, updateData)

		BroadcastChannelSender.updateAccount(magic_id, updateData)

		return userInfoResponse
	}

	/**
	 * @description 设置UserStore中的用户信息
	 * @param userInfo
	 */
	setUserInfo(userInfo: User.UserInfo | null) {
		const info = userInfo ?? null
		// 数据持久化同步
		const user = new UserRepository()
		user.setUserInfo(info)

		// 内存状态同步
		userStore.user.setUserInfo(info)

		// 获取当前账号的 authorization
		const accessToken = userStore.user.authorization ?? ""

		// 有值才获取
		if (info) {
			// 同步账号信息到原生 App
			getNativePort().account.syncAccountInfo({
				domain: env("MAGIC_SERVICE_BASE_URL"),
				token: accessToken,
				userId: info.user_id,
				organizationCode: info.organization_code,
			})
			AuthApi.getAdminPermission().then((res) => {
				userStore.user.setIsAdmin(res.is_admin)
			})
		}
		return info
	}

	/**
	 * @description 组织同步
	 */
	setOrganization(params: OrganizationResponse) {
		const {
			organizationCode,
			teamshareOrganizationCode,
			organizations = [],
			magicOrganizationMap = {},
		} = params

		// fallback when magic organization sync third party organization, but not sync name and logo
		const { nameMap, logoMap } = organizations.reduce(
			(acc, item) => {
				acc.nameMap[item.organization_code] = item.organization_name
				acc.logoMap[item.organization_code] = item.organization_logo?.[0]?.url ?? ""
				return acc
			},
			{ nameMap: {}, logoMap: {} } as {
				nameMap: Record<string, string>
				logoMap: Record<string, string>
			},
		)

		Object.values(magicOrganizationMap).forEach((item) => {
			if (!item.organization_name) {
				item.organization_name = nameMap?.[item.third_platform_organization_code] ?? ""
			}
			if (!item.organization_logo) {
				item.organization_logo = logoMap?.[item.third_platform_organization_code] ?? ""
			}
		})

		// 数据持久化同步（批量写入优化：4次写入 → 1次事务）
		const user = new UserRepository()
		user.setBatchOrganizationData({
			organizations: magicOrganizationMap ?? {},
			organizationCode: organizationCode ?? "",
			teamshareOrganizations: organizations ?? [],
			teamshareOrganizationCode: teamshareOrganizationCode ?? "",
		})

		// 内存状态同步
		userStore.user.setOrganizationCode(organizationCode || "")
		userStore.user.setOrganizations(magicOrganizationMap || {})
		// userStore.user.setTeamshareOrganizations(organizations || [])
		userStore.user.setTeamshareOrganization(teamshareOrganizationCode || "", organizations)
	}

	/**
	 * @description 设置Teamshare组织列表
	 */
	setTeamshareOrganizations(organizations: Array<User.UserOrganization>) {
		const user = new UserRepository()
		user.setTeamshareOrganizations(organizations ?? [])
		userStore.user.setTeamshareOrganizations(organizations || [])
	}

	/**
	 * @description 组织切换
	 */
	switchOrganization = async (
		magic_user_id: string,
		magic_organization_code: string,
		fallbackUserInfo: User.UserInfo,
	) => {
		try {
			this.setMagicOrganizationCode(magic_organization_code)

			// // 拉取用户信息
			// const { items } = await this.contactApi.getUsersInfo({
			// 	user_ids: [magic_user_id],
			// 	query_type: 2,
			// })

			const targetUser = await this.contactApi.getAccountUserInfo({
				organization_code: magic_organization_code,
			})

			if (!targetUser) {
				throw new Error("targetUser is null")
			}

			const userInfo = userTransformer(targetUser)
			this.setUserInfo(userInfo)

			/** 广播切换组织 */
			BroadcastChannelSender.switchOrganization({
				userInfo,
				magicOrganizationCode: magic_organization_code,
			})
		} catch (err) {
			console.error(err)
			// 切换失败，恢复当前组织
			this.setMagicOrganizationCode(fallbackUserInfo?.organization_code)
			this.setUserInfo(fallbackUserInfo)
		}
	}

	setMagicOrganizationCode(organizationCode: string) {
		const user = new UserRepository()
		const { magicOrganizationMap } = userStore.user
		const teamshareOrgCode =
			magicOrganizationMap?.[organizationCode]?.third_platform_organization_code ?? ""
		user.setOrganizationCode(organizationCode)
		user.setTeamshareOrganizationCode(teamshareOrgCode)

		userStore.user.setOrganizationCode(organizationCode)
		userStore.user.setTeamshareOrganization(teamshareOrgCode)
	}

	async setTeamshareOrganization(organizationCode: string) {
		const user = new UserRepository()
		const { magicOrganizationMap } = userStore.user
		const orgMap = keyBy(
			Object.values(magicOrganizationMap),
			"third_platform_organization_code",
		)
		const orgCode = orgMap?.[organizationCode]?.magic_organization_code
		user.setOrganizationCode(orgCode)
		user.setTeamshareOrganizationCode(organizationCode)

		userStore.user.setOrganizationCode(orgCode)
		userStore.user.setTeamshareOrganization(organizationCode)

		// 拉取用户信息
		const { items } = await this.contactApi.getUsersInfo({
			user_ids: [orgMap?.[organizationCode]?.magic_user_id],
			query_type: 2,
		})

		const targetUser = items[0]

		if (!targetUser) {
			throw new Error("targetUser is null")
		}

		const userInfo = userTransformer(targetUser)
		this.setUserInfo(userInfo)

		/** 广播切换组织 */
		BroadcastChannelSender.switchOrganization({
			userInfo,
			magicOrganizationCode: orgCode,
		})
	}

	removeOrganization() {
		const user = new UserRepository()
		user.setOrganizations({})
		user.setOrganizationCode("")
		user.setTeamshareOrganizations([])
		user.setTeamshareOrganizationCode("")

		userStore.user.setOrganizationCode("")
		userStore.user.setOrganizations({})
		userStore.user.setTeamshareOrganization("", [])
		// userStore.user.setTeamshareOrganizations([])
	}

	// /**
	//  * @description 账号添加
	//  * @param userAccount
	//  */
	// setAccount(userAccount: User.UserAccount) {
	// 	// 数据持久化同步
	// 	const account = new AccountRepository()
	// 	account.put(userAccount).catch(logger.error)
	//
	// 	// 内存状态同步
	// 	userStore.account.setAccount(userAccount)
	//
	// 	// 广播添加账号
	// 	BroadcastChannelSender.addAccount(userAccount)
	// }

	// /**
	//  * FIXME: 错误时，恢复当前账号
	//  * @description 账号切换
	//  * @param unionId
	//  * @param magicOrganizationCode
	//  */
	// switchAccount = async (unionId: string, magicOrganizationCode: string) => {
	// 	const { accounts } = userStore.account
	// 	const account = accounts.find((o) => o.magic_id === unionId)
	// 	if (account) {
	// 		// const magicOrgSyncStep = this.service
	// 		// 	.get<LoginService>("loginService")
	// 		// 	.magicOrganizationSyncStep(account?.deployCode as string)
	//
	// 		this.setAuthorization(account?.access_token)
	//
	// 		if (magicOrganizationCode) {
	// 			// 同步用户对应组织
	// 			this.setMagicOrganizationCode(magicOrganizationCode)
	// 			// Step 1: 环境同步
	// 			await this.service
	// 				.get<LoginService>("loginService")
	// 				.getClusterConfig(account.deployCode)
	//
	// 			await this.service
	// 				.get<ConfigService>("configService")
	// 				.setClusterCode(account.deployCode)
	//
	// 			// Step 2: 同步用户信息
	// 			await this.fetchUserInfo()
	// 			// Step 3: magic中组织体系获取
	// 			const magicOrganizationMap = await this.service
	// 				.get<LoginService>("loginService")
	// 				.magicOrganizationSync(account?.deployCode || "", account.access_token)
	// 			// const { magicOrganizationMap } = await magicOrgSyncStep({
	// 			// 	access_token: account.access_token,
	// 			// } as Login.UserLoginsResponse)
	// 			// Step 4: 组织同步(先获取在同步)
	// 			// const response = await this.service
	// 			// 	.get<LoginService>("loginService")
	// 			// 	.organizationFetchStep({
	// 			// 		magicOrganizationMap,
	// 			// 		access_token: account.access_token,
	// 			// 		deployCode: account.deployCode,
	// 			// 	})
	// 			//
	// 			// await this.service.get<LoginService>("loginService").organizationSyncStep(response)
	// 			/**
	// 			 * 组织同步(先获取在同步)
	// 			 */
	// 			// 第三方组织获取
	// 			const { organizations, organizationCode, thirdPlatformOrganizationCode } =
	// 				await this.service
	// 					.get<LoginService>("loginService")
	// 					.getThirdPlatformOrganization(
	// 						magicOrganizationMap,
	// 						account.access_token,
	// 						account.deployCode,
	// 					)
	//
	// 			this.setOrganization({
	// 				organizationCode,
	// 				teamshareOrganizationCode: thirdPlatformOrganizationCode,
	// 				organizations,
	// 				magicOrganizationMap,
	// 			})
	//
	// 			await this.wsLogin({ showLoginLoading: true })
	// 		}
	// 	}
	// }

	// /**
	//  * @description 账号移除
	//  * @param unionId
	//  */
	// deleteAccount = async (unionId?: string) => {
	// 	const allClean = async () => {
	// 		MessageService.destroy()
	//
	// 		// 移除当前token
	// 		const user = new UserRepository()
	// 		await user.setAuthorization("")
	// 		userStore.user.setAuthorization(null)
	// 		userStore.account.clearAccount()
	//
	// 		this.setUserInfo(null)
	// 		this.removeOrganization()
	//
	// 		const account = new AccountRepository()
	// 		await account.clear()
	// 	}
	// 	if (unionId) {
	// 		// 移除持久化数据
	// 		const account = new AccountRepository()
	// 		await account.delete(unionId)
	//
	// 		userStore.account.deleteAccount(unionId)
	//
	// 		if (userStore.account.accounts.length === 0) {
	// 			await allClean()
	// 		}
	// 	} else {
	// 		this.service.get<LoginService>("loginService").logout()
	// 		await allClean()
	// 	}
	// }

	// /**
	//  * @description 帐号同步（同步组织、用户等信息）
	//  */
	// async fetchAccount() {
	// 	// const { accounts } = userStore.account
	// 	//
	// 	// const task = []
	// 	//
	// 	// const loginService = this.service.get<LoginService>("loginService")
	// 	//
	// 	// for (let i = 0, len = accounts.length; i < len; i += 1) {
	// 	// 	const account = accounts[i]
	// 	//
	// 	// 	const job = () => {
	// 	// 		// eslint-disable-next-line no-async-promise-executor
	// 	// 		return new Promise(async (resolve) => {
	// 	// 			// 环境同步
	// 	// 			await loginService.getClusterConfig(account?.deployCode)
	// 	// 			// magic 组织同步
	// 	// 			const magicOrgSyncStep = loginService.magicOrganizationSyncStep(
	// 	// 				account?.deployCode,
	// 	// 			)
	// 	// 			const { magicOrganizationMap } = await magicOrgSyncStep({
	// 	// 				access_token: account?.access_token,
	// 	// 			} as Login.UserLoginsResponse)
	// 	// 			// teamshare 组织同步
	// 	// 			const { organizations } = await loginService.organizationFetchStep({
	// 	// 				magicOrganizationMap,
	// 	// 				access_token: account.access_token,
	// 	// 				deployCode: account?.deployCode,
	// 	// 			})
	// 	//
	// 	// 			// TODO: 补充账号更新逻辑
	// 	// 			// userStore.account.updateAccount(account.magic_id, {
	// 	// 			// 	...account,
	// 	// 			// 	organizations: Object.values(magicOrganizationMap),
	// 	// 			// 	teamshareOrganizations: organizations || [],
	// 	// 			// })
	// 	//
	// 	// 			resolve({ organizations, magicOrganizationMap })
	// 	// 		})
	// 	// 	}
	// 	//
	// 	// 	task.push(job())
	// 	// }
	// 	//
	// 	// Promise.all(task)
	// 	// 	.then((response) => {
	// 	// 		logger.log("account update success", response)
	// 	// 	})
	// 	// 	.catch(logger.error)
	// }

	wsLogin() {
		const { authorization, userInfo } = userStore.user

		if (!authorization || !userInfo?.user_id) {
			throw new Error("authorization or user_id is required")
		}

		// 如果当前登录的 authorization 与 lastLogin 的 authorization 相同，则返回 lastLogin 的 promise
		if (
			authorization === this.lastLogin?.authorization &&
			userInfo?.user_id === this.lastLogin.user_id &&
			this.lastLogin.promise
		) {
			logger.log("authorization 相同，返回 lastLogin 的 promise", this.lastLogin)
			return this.lastLogin.promise
		}

		this.lastLogin = {
			authorization,
			user_id: userInfo.user_id,
			promise: ChatApi.login(authorization)
				.then(async (res) => {
					logger.log("ws 登录成功", res)
					// 切换 chat 数据
					// await this.loadUserInfo(res.data.user, { showSwitchLoading: showLoginLoading })
				})
				.catch(async (err) => {
					logger.log("ws 登录失败", err)
					if (err.code === 3103) {
						logger.log(err)
						// accountBusiness.accountLogout() -》 this.deleteAccount()
						await this.service.get<AccountService>("accountService").deleteAccount()
					}
				})
				.finally(() => {
					logger.log("ws 登录结束")
					if (
						this.lastLogin?.authorization === authorization &&
						this.lastLogin.user_id === userInfo.user_id
					) {
						this.lastLogin = null
					}
				}),
		}

		return this.lastLogin.promise
	}

	/*
	 * @description 清除 lastLogin
	 */
	clearLastLogin() {
		this.lastLogin = null
	}
}
