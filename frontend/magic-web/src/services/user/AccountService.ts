import { AccountRepository } from "@/models/user/repositories/AccountRepository"
import { userStore } from "@/models/user"
import { getHtmlPermissionGrantStore } from "@/pages/superMagic/components/Detail/contents/HTML/iframe-api/services/IndexedDbHtmlPermissionGrantStore"
import type { User } from "@/types/user"
import { logger as Logger } from "@/infrastructure/logger"
import { BroadcastChannelSender } from "@/broadcastChannel"
import type * as apis from "@/apis"
import type { Container } from "@/services/ServiceContainer"
import { UserService } from "./UserService"
import type { LoginService } from "./LoginService/LoginService"
import type { ConfigService } from "../config/ConfigService"
import { UserRepository } from "@/models/user/repositories/UserRepository"
import MessageService from "@/services/chat/message/MessageService"
import { clearNotificationCenterUserCache } from "@/components/business/NotificationCenter/store"
import { OrganizationService } from "./OrganizationService"
import { isEmpty, keyBy } from "lodash-es"
import { toJS } from "mobx"

const logger = Logger.createLogger("AccountService")

export class AccountService {
	private readonly service: Container
	private readonly authApi: typeof apis.AuthApi

	constructor(dependencies: Pick<typeof apis, "AuthApi">, service: Container) {
		this.authApi = dependencies.AuthApi
		this.service = service
	}

	async init() {
		// Synchronize all accounts
		const account = new AccountRepository()
		const accounts = await account.getAllAccounts()

		accounts.forEach((a) => {
			if (!isEmpty(a)) {
				userStore.account.setAccount(a)
			}
		})
	}

	/**
	 * @description 账号添加
	 * @param userAccount
	 */
	setAccount(userAccount: User.UserAccount) {
		// 数据持久化同步
		const account = new AccountRepository()
		const persistence = account.addAccount(userAccount)
		void persistence.catch(logger.error)

		// 内存状态同步
		userStore.account.setAccount(userAccount)

		// 广播添加账号
		BroadcastChannelSender.addAccount(userAccount)

		// Bootstrap callers must wait for disk as well as memory before reporting success.
		return persistence
	}

	/**
	 * @description 账号切换
	 * @param unionId
	 * @param magicOrganizationCode
	 */
	switchAccount = async (unionId: string, magicOrganizationCode: string) => {
		logger.report("switchAccount", unionId, magicOrganizationCode, new Error())
		const accounts = toJS(userStore.account.accounts)
		const account = accounts.find((o) => o.magic_id === unionId)

		if (account) {
			this.service.get<UserService>("userService").setAuthorization(account?.access_token)

			if (magicOrganizationCode) {
				/**
				 * 优先处理集群变更的问题，集群一旦变更后所有 baseURL 都需要变更防止账号、组织、用户信息等初始化会依赖旧的 baseURL 导致请求异常。
				 * 但大前提是确保当前账号的 token 是可用的，所以必须优先调用 API 确认 token 的实效性。
				 */
				// Step 1: 校验 Token 是否可用（停止 401 处理，交由业务层处理）
				await this.authApi.bindMagicAuthorization(
					account?.access_token,
					account.deployCode,
					magicOrganizationCode,
				)
				// Step 2: 集群环境同步
				await this.service
					.get<LoginService>("loginService")
					.getClusterConfig(account.deployCode)

				await this.service
					.get<ConfigService>("configService")
					.setClusterCode(account.deployCode)

				// 优先同步新账号的所有组织
				this.service
					.get<OrganizationService>("organizationService")
					.setOrganizationByAccount({
						organizations: account.teamshareOrganizations,
						magicOrganizationMap: keyBy(
							account.organizations,
							"magic_organization_code",
						),
					})

				// 同步用户对应组织
				this.service
					.get<UserService>("userService")
					.setMagicOrganizationCode(magicOrganizationCode)

				// Step 3: 同步用户信息
				clearNotificationCenterUserCache()
				await this.service.get<UserService>("userService").fetchUserInfo()
				const magicOrganizationMap = await this.service
					.get<LoginService>("loginService")
					.magicOrganizationSync(account?.deployCode || "", account.access_token)

				/**
				 * 组织同步(先获取在同步)
				 */
				// 第三方组织获取
				const { organizations, organizationCode, thirdPlatformOrganizationCode } =
					await this.service
						.get<LoginService>("loginService")
						.getThirdPlatformOrganization(
							magicOrganizationMap,
							account.access_token,
							account.deployCode,
						)

				this.service.get<UserService>("userService").setOrganization({
					organizationCode,
					teamshareOrganizationCode: thirdPlatformOrganizationCode,
					organizations,
					magicOrganizationMap,
				})

				await this.service.get<UserService>("userService").wsLogin()
			}
		}
	}

	/**
	 * @description 账号移除
	 * @param unionId
	 */
	invalidateSession = async ({ accountId }: { accountId?: string } = {}) => {
		const currentAccountId = userStore.user.userInfo?.magic_id
		const targetAccountId = accountId ?? currentAccountId
		const accountRepository = new AccountRepository()
		let cleanupStatus: "completed" | "partial" = "completed"
		// Authentication has already failed on the server. This path only removes
		// local session state and deliberately does not call remote logout or abort
		// shared HTTP clients, so the auth event can always reach navigation.
		try {
			await getHtmlPermissionGrantStore().clear()
		} catch (error) {
			cleanupStatus = "partial"
			logger.error({
				eventKey: "clear_html_permission_grants_failed",
				errorKind: "storage",
				error,
				message: "Failed to clear HTML permission grants during session invalidation",
			})
		}

		if (targetAccountId) {
			await accountRepository.deleteAccount(targetAccountId)
			userStore.account.deleteAccount(targetAccountId)
		}

		if (targetAccountId !== currentAccountId && currentAccountId) return { cleanupStatus }

		const user = new UserRepository()
		await user.setAuthorization("")
		userStore.user.setAuthorization(null)
		userStore.user.setUserInfo(null)
		this.service.get<UserService>("userService").setUserInfo(null)
		this.service.get<UserService>("userService").removeOrganization()
		await this.service.get<ConfigService>("configService").setClusterCode("")
		MessageService.destroy()
		clearNotificationCenterUserCache()

		return { cleanupStatus }
	}

	deleteAccount = async (unionId?: string) => {
		logger.report("deleteAccount", new Error())
		// Account removal is a security lifecycle event. Clear the shared consent cache even
		// when another cached account remains, because stored grants intentionally have no plaintext owner ID.
		try {
			await getHtmlPermissionGrantStore().clear()
		} catch (error) {
			// Permission storage cleanup is best effort and must not prevent token removal or logout.
			logger.error({
				eventKey: "clear_html_permission_grants_failed",
				errorKind: "storage",
				error,
				message: "Failed to clear HTML permission grants during account removal",
			})
		}
		const allClean = async () => {
			MessageService.destroy()
			clearNotificationCenterUserCache()

			// 移除当前token
			const user = new UserRepository()
			await user.setAuthorization("")
			userStore.user.setAuthorization(null)
			userStore.account.clearAccount()

			this.service.get<UserService>("userService").setUserInfo(null)
			this.service.get<UserService>("userService").removeOrganization()
			// 清空全局 active cluster，让退出后的请求回退到 SaaS；
			// 同时保留缓存私有码，方便登录页继续恢复上一次私有化入口 /
			// Clear the global active cluster so post-logout requests fall back to SaaS.
			// Keep the cached private cluster code untouched so the login page can still
			// restore the previous private login option.
			await this.service.get<ConfigService>("configService").setClusterCode("")

			const account = new AccountRepository()
			await account.clearAccount()
		}
		if (unionId) {
			// 移除持久化数据
			const account = new AccountRepository()
			await account.deleteAccount(unionId)

			userStore.account.deleteAccount(unionId)

			if (userStore.account.accounts.length === 0) {
				await allClean()
			}
		} else {
			this.service.get<LoginService>("loginService").logout()
			await allClean()
		}
	}

	/**
	 * @description 帐号同步（同步组织、用户等信息）
	 */
	async fetchAccount() {
		// const { accounts } = userStore.account
		//
		// const task = []
		//
		// const loginService = this.service.get<LoginService>("loginService")
		//
		// for (let i = 0, len = accounts.length; i < len; i += 1) {
		// 	const account = accounts[i]
		//
		// 	const job = () => {
		// 		// eslint-disable-next-line no-async-promise-executor
		// 		return new Promise(async (resolve) => {
		// 			// 环境同步
		// 			await loginService.getClusterConfig(account?.deployCode)
		// 			// magic 组织同步
		// 			const magicOrgSyncStep = loginService.magicOrganizationSyncStep(
		// 				account?.deployCode,
		// 			)
		// 			const { magicOrganizationMap } = await magicOrgSyncStep({
		// 				access_token: account?.access_token,
		// 			} as Login.UserLoginsResponse)
		// 			// teamshare 组织同步
		// 			const { organizations } = await loginService.organizationFetchStep({
		// 				magicOrganizationMap,
		// 				access_token: account.access_token,
		// 				deployCode: account?.deployCode,
		// 			})
		//
		// 			// TODO: 补充账号更新逻辑
		// 			// userStore.account.updateAccount(account.magic_id, {
		// 			// 	...account,
		// 			// 	organizations: Object.values(magicOrganizationMap),
		// 			// 	teamshareOrganizations: organizations || [],
		// 			// })
		//
		// 			resolve({ organizations, magicOrganizationMap })
		// 		})
		// 	}
		//
		// 	task.push(job())
		// }
		//
		// Promise.all(task)
		// 	.then((response) => {
		// 		logger.log("account update success", response)
		// 	})
		// 	.catch(logger.error)
	}
}
