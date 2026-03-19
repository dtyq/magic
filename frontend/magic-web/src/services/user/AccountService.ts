import { AccountRepository } from "@/models/user/repositories/AccountRepository"
import { userStore } from "@/models/user"
import type { User } from "@/types/user"
import { logger as Logger } from "@/utils/log"
import { BroadcastChannelSender } from "@/broadcastChannel"
import type * as apis from "@/apis"
import type { Container } from "@/services/ServiceContainer"
import { UserService } from "./UserService"
import type { LoginService } from "./LoginService/LoginService"
import type { ConfigService } from "../config/ConfigService"
import { UserRepository } from "@/models/user/repositories/UserRepository"
import MessageService from "@/services/chat/message/MessageService"
import { OrganizationService } from "./OrganizationService"
import { isEmpty, keyBy } from "lodash-es"
import { toJS } from "mobx"

const logger = Logger.createLogger("AccountService")

export class AccountService {
	private readonly service: Container

	constructor(_dependencies: typeof apis, service: Container) {
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
		account.addAccount(userAccount).catch(logger.error)

		// 内存状态同步
		userStore.account.setAccount(userAccount)

		// 广播添加账号
		BroadcastChannelSender.addAccount(userAccount)
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
				// Step 1: 环境同步
				await this.service
					.get<LoginService>("loginService")
					.getClusterConfig(account.deployCode)

				await this.service
					.get<ConfigService>("configService")
					.setClusterCode(account.deployCode)

				// Step 2: 同步用户信息
				await this.service.get<UserService>("userService").fetchUserInfo()
				// Step 3: magic中组织体系获取
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
	deleteAccount = async (unionId?: string) => {
		logger.report("deleteAccount", new Error())
		const allClean = async () => {
			MessageService.destroy()

			// 移除当前token
			const user = new UserRepository()
			await user.setAuthorization("")
			userStore.user.setAuthorization(null)
			userStore.account.clearAccount()

			this.service.get<UserService>("userService").setUserInfo(null)
			this.service.get<UserService>("userService").removeOrganization()

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
