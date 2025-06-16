/* eslint-disable class-methods-use-this */
import type { StructureUserItem } from "@/types/organization"
import type { User } from "@/types/user"
import { keyBy } from "lodash-es"
import type { Login } from "@/types/login"
import { initDataContextDb } from "@/opensource/database/data-context"
import type * as apis from "@/opensource/apis"
import type { Container } from "@/opensource/services/ServiceContainer"
import { userStore } from "@/opensource/models/user/stores"
import { userTransformer } from "@/opensource/models/user/transformers"
import { UserRepository } from "@/opensource/models/user/repositories/UserRepository"
import { AccountRepository } from "@/opensource/models/user/repositories/AccountRepository"
import type { LoginService } from "./LoginService"
import chatWebSocket from "@/opensource/apis/clients/chatWebSocket"
import groupInfoService from "@/opensource/services/groupInfo"
import userInfoService from "@/opensource/services/userInfo"
import chatDb from "@/opensource/database/chat"
import MessageSeqIdService from "@/opensource/services/chat/message/MessageSeqIdService"
import MessageService from "@/opensource/services/chat/message/MessageService"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import { interfaceStore } from "@/opensource/stores/interface"
import { ChatApi } from "@/apis"
import ChatFileService from "../chat/file/ChatFileService"
import EditorDraftService from "../chat/editor/DraftService"
import Logger from "@/utils/log/Logger"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"

const console = new Logger("UserService")

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
		promise: Promise<void>
	} | null = null

	constructor(dependencies: typeof apis, service: Container) {
		this.contactApi = dependencies.ContactApi
		this.service = service

		/** 监听连接成功事件,自动登录 */
		chatWebSocket.on("open", ({ reconnect }) => {
			console.log("open", { reconnect })
			if (reconnect) {
				console.log("重新连接成功，自动登录")
				this.wsLogin({ showLoginLoading: false })
			}
		})
	}

	/**
	 * @description 初始化(持久化数据/内存状态)
	 */
	async init() {
		// 同步当前用户状态
		const user = new UserRepository()
		const token = await user.getAuthorization()
		const userInfo = await user.getUserInfo()

		userStore.user.setAuthorization(token ?? null)
		userStore.user.setUserInfo(userInfo ?? null)

		// 组织同步
		const organizations = await user.getOrganizations()
		const organizationCode = await user.getOrganizationCode()
		const teamshareOrganizations = await user.getTeamshareOrganizations()
		const teamshareOrganizationCode = await user.getTeamshareOrganizationCode()

		userStore.user.setOrganizations(organizations ?? {})
		userStore.user.setOrganizationCode(organizationCode ?? "")
		userStore.user.setTeamshareOrganizations(teamshareOrganizations ?? [])
		userStore.user.setTeamshareOrganizationCode(teamshareOrganizationCode ?? "")

		// 同步所有帐号
		const account = new AccountRepository()
		const accounts = await account.getAll()

		accounts.map((a) => userStore.account.setAccount(a))
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
		// 	console.warn("withPrivateDeploy Step 1: 同步当前账号deployCode", deployCode)
		//
		// 	// Step 2: 获取环境配置
		// 	const config = await loginService.envSyncStep(deployCode)
		// 	console.warn("withPrivateDeploy Step 2: 获取 deployConfig ", config)
		// }
	}

	/**
	 * @description 移除当前用户token
	 */
	setAuthorization(authorization: string | null) {
		// 设置内存状态、同步数据持久化
		const user = new UserRepository()
		user.setAuthorization(authorization ?? "")

		userStore.user.setAuthorization(authorization)
	}

	/**
	 * @description 获取用户信息
	 * @param {string} unionId 用户唯一ID
	 */
	fetchUserInfo = async (unionId: string): Promise<StructureUserItem | null> => {
		if (!unionId) {
			return null
		}
		const { items } = await this.contactApi.getUserInfos({ user_ids: [unionId] })
		return items?.[0]
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

		// 有值才获取
		// if (info) {
		// 	AuthApi.getAdminPermission().then((res) => {
		// 		userStore.user.isAdmin = res.is_admin
		// 	})
		// }
		return info
	}

	/**
	 * @description 组织同步
	 */
	setOrganization(params: OrganizationResponse) {
		const { organizationCode, teamshareOrganizationCode, organizations, magicOrganizationMap } =
			params
		// 数据持久化同步
		const user = new UserRepository()
		user.setOrganizations(magicOrganizationMap ?? {})
		user.setOrganizationCode(organizationCode ?? "")
		user.setTeamshareOrganizations(organizations ?? [])
		user.setTeamshareOrganizationCode(teamshareOrganizationCode ?? "")

		// 内存状态同步
		userStore.user.setOrganizationCode(organizationCode || "")
		userStore.user.setTeamshareOrganizationCode(teamshareOrganizationCode || "")
		userStore.user.setOrganizations(magicOrganizationMap || {})
		userStore.user.setTeamshareOrganizations(organizations || [])
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

			// 拉取用户信息
			const { items } = await this.contactApi.getUserInfos({
				user_ids: [magic_user_id],
				query_type: 2,
			})

			const targetUser = items[0]

			if (!targetUser) {
				throw new Error("targetUser is null")
			}

			const userInfo = userTransformer(targetUser)
			await this.loadUserInfo(userInfo, { showSwitchLoading: true })
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
		userStore.user.setTeamshareOrganizationCode(teamshareOrgCode)
	}

	setTeamshareOrganizationCode(organizationCode: string) {
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
		userStore.user.setTeamshareOrganizationCode(organizationCode)
	}

	removeOrganization() {
		const user = new UserRepository()
		user.setOrganizations({})
		user.setOrganizationCode("")
		user.setTeamshareOrganizations([])
		user.setTeamshareOrganizationCode("")

		userStore.user.setOrganizationCode("")
		userStore.user.setTeamshareOrganizationCode("")
		userStore.user.setOrganizations({})
		userStore.user.setTeamshareOrganizations([])
	}

	/**
	 * @description 账号添加
	 * @param userAccount
	 */
	setAccount(userAccount: User.UserAccount) {
		// 数据持久化同步
		const account = new AccountRepository()
		account.put(userAccount).catch(console.error)

		// 内存状态同步
		userStore.account.setAccount(userAccount)

		// 广播添加账号
		BroadcastChannelSender.addAccount(userAccount)
	}

	/**
	 * FIXME: 错误时，恢复当前账号
	 * @description 账号切换
	 * @param unionId
	 * @param magicOrganizationCode
	 */
	switchAccount = async (
		unionId: string,
		magic_user_id: string,
		magic_organization_code: string,
	) => {
		const { accounts } = userStore.account
		const account = accounts.find((o) => o.magic_id === unionId)
		if (account) {
			const magicOrgSyncStep = this.service
				.get<LoginService>("loginService")
				.magicOrganizationSyncStep(account?.deployCode as string)

			this.setAuthorization(account?.access_token)

			if (magic_user_id && magic_organization_code) {
				// 同步用户对应组织
				this.setMagicOrganizationCode(magic_organization_code)
				// Step 1: 环境同步
				await this.service
					.get<LoginService>("loginService")
					.getClusterConfig(account.deployCode)
				// Step 2: 同步用户信息
				await this.service
					.get<LoginService>("loginService")
					.fetchUserInfoStep(magic_user_id)
				// Step 3: magic中组织体系获取
				const { magicOrganizationMap } = await magicOrgSyncStep({
					access_token: account.access_token,
				} as Login.UserLoginsResponse)
				// Step 4: 组织同步(先获取在同步)
				const response = await this.service
					.get<LoginService>("loginService")
					.organizationFetchStep({
						magicOrganizationMap,
						access_token: account.access_token,
						deployCode: account.deployCode,
					})
				await this.service.get<LoginService>("loginService").organizationSyncStep(response)

				await this.wsLogin({ showLoginLoading: true })
			}
		}
	}

	/**
	 * @description 账号移除
	 * @param unionId
	 */
	deleteAccount = async (unionId?: string) => {
		const allClean = async () => {
			MessageService.destroy()

			// remove the current token
			const user = new UserRepository()
			await user.setAuthorization("")
			userStore.user.setAuthorization(null)

			this.setUserInfo(null)
			this.removeOrganization()

			const account = new AccountRepository()
			await account.clear()
		}
		if (unionId) {
			// 移除持久化数据
			const account = new AccountRepository()
			await account.delete(unionId)

			userStore.account.deleteAccount(unionId)

			if (userStore.account.accounts.length === 0) {
				await allClean()
			}
		} else {
			await allClean()
		}
	}

	/**
	 * @description 帐号同步（同步组织、用户等信息）
	 */
	async fetchAccount() {
		const { accounts } = userStore.account

		const task = []

		const loginService = this.service.get<LoginService>("loginService")

		for (let i = 0, len = accounts.length; i < len; i += 1) {
			const account = accounts[i]

			const job = () => {
				// eslint-disable-next-line no-async-promise-executor
				return new Promise(async (resolve) => {
					// 环境同步
					await loginService.getClusterConfig(account?.deployCode)
					// magic 组织同步
					const magicOrgSyncStep = loginService.magicOrganizationSyncStep(
						account?.deployCode,
					)
					const { magicOrganizationMap } = await magicOrgSyncStep({
						access_token: account?.access_token,
					} as Login.UserLoginsResponse)
					// teamshare 组织同步
					const { organizations } = await loginService.organizationFetchStep({
						magicOrganizationMap,
						access_token: account.access_token,
						deployCode: account?.deployCode,
					})

					userStore.account.updateAccount(account.magic_id, {
						...account,
						organizations: Object.values(magicOrganizationMap),
						teamshareOrganizations: organizations || [],
					})

					resolve({ organizations, magicOrganizationMap })
				})
			}

			task.push(job())
		}

		Promise.all(task)
			.then((response) => {
				console.log("account update success", response)
			})
			.catch(console.error)
	}

	wsLogin({ showLoginLoading = true }: { showLoginLoading?: boolean } = {}) {
		const { authorization } = userStore.user

		if (!authorization) {
			throw new Error("authorization or organization_code is required")
		}

		// 如果当前登录的 authorization 与 lastLogin 的 authorization 相同，则返回 lastLogin 的 promise
		if (authorization === this.lastLogin?.authorization) {
			console.log("authorization 相同，返回 lastLogin 的 promise", this.lastLogin)
			return this.lastLogin.promise
		}

		this.lastLogin = {
			authorization,
			promise: ChatApi.login(authorization)
				.then(async (res) => {
					userStore.user.setUserInfo(res.data.user)
					console.log("ws 登录成功", res)
					// 切换 chat 数据
					await this.loadUserInfo(res.data.user, { showSwitchLoading: showLoginLoading })
				})
				.catch(async (err) => {
					console.log("ws 登录失败", err)
					if (err.code === 3103) {
						console.log(err)
						// accountBusiness.accountLogout() -》 this.deleteAccount()
						await this.deleteAccount()
					}
					if (this.lastLogin?.authorization === authorization) {
						this.lastLogin.promise = Promise.reject(err)
					}
				})
				.finally(() => {
					console.log("ws 登录结束")
					if (this.lastLogin?.authorization === authorization) {
						this.lastLogin.promise = Promise.resolve()
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
	/**
	 * @description 切换用户
	 * @param magicUser
	 * @param showSwitchLoading
	 */
	async loadUserInfo(
		magicUser: User.UserInfo,
		{ showSwitchLoading = true }: { showSwitchLoading?: boolean } = {},
	) {
		try {
			const magicId = magicUser.magic_id
			const userId = magicUser.user_id

			console.log("切换账户", magicId)
			if (showSwitchLoading) interfaceStore.setIsSwitchingOrganization(true)

			// 如果当前账户ID与传入的账户ID相同，则不进行切换
			chatDb.switchDb(magicId)
			ChatFileService.init()
			EditorDraftService.initDrafts()

			const db = initDataContextDb(magicId, userId)
			await userInfoService.loadData(db)
			await groupInfoService.loadData(db)

			// 检查所有组织的渲染序列号
			MessageSeqIdService.checkAllOrganizationRenderSeqId()

			// 重连情况，不重置视图
			if (showSwitchLoading) {
				// 重置消息数据视图
				conversationService.reset() // 切换到空会话
				MessageService.reset()
			}

			/** 如果是第一次加载，则拉取 消息 */
			if (!MessageSeqIdService.getGlobalPullSeqId()) {
				await MessageService.pullMessageOnFirstLoad(
					magicUser.magic_id,
					magicUser.organization_code,
				)
			} else {
				await conversationService.init(
					magicUser.magic_id,
					magicUser.organization_code,
					magicUser,
				)
				// 拉取离线消息（内部只会应用该组织的信息）
				MessageService.pullOfflineMessages()
			}

			// this.conversationGroupBusiness.initConversationGroups(
			// 	magicUser.magic_id,
			// 	magicUser.organization_code,
			// )

			/** 设置消息拉取 循环 */
			MessageService.init()
			// this.messagePullBusiness.registerMessagePullLoop()
			if (showSwitchLoading) interfaceStore.setIsSwitchingOrganization(false)
		} catch (error) {
			console.error("切换账户失败", error)
		}
	}
}
