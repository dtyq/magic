import type { User } from "@/types/user"
import type * as apis from "@/apis"
import type { Container } from "@/services/ServiceContainer"
import { userStore } from "@/models/user/stores"
import type { LoginService } from "./LoginService/LoginService"
import { UserRepository } from "@/models/user/repositories/UserRepository"
import { AccountRepository } from "@/models/user/repositories/AccountRepository"
import { BroadcastChannelSender } from "@/broadcastChannel"
import type { UserService } from "@/services/user/UserService"

export interface Organizations {
	magicOrganizationMap: Record<string, User.MagicOrganization>
	organizations?: Array<User.UserOrganization>
}

export class OrganizationService {
	private readonly service: Container

	constructor(_dependencies: typeof apis, service: Container) {
		this.service = service
	}

	/**
	 * @description 设置组织列表
	 */
	setOrganization(params: Organizations, magicId: string) {
		const { organizations = [], magicOrganizationMap = {} } = params

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

		const magicOrganizations = Object.values(magicOrganizationMap)

		magicOrganizations.forEach((item) => {
			if (!item.organization_name) {
				item.organization_name = nameMap?.[item.third_platform_organization_code] ?? ""
			}
			if (!item.organization_logo) {
				item.organization_logo = logoMap?.[item.third_platform_organization_code] ?? ""
			}
		})

		// 数据持久化同步
		const user = new UserRepository()
		const account = new AccountRepository()

		user.setOrganizations(magicOrganizationMap ?? {})
		user.setTeamshareOrganizations(organizations ?? [])
		account.updateAccount(magicId, {
			organizations: magicOrganizations,
			teamshareOrganizations: organizations,
		})

		// 内存状态同步
		userStore.user.setOrganizations(magicOrganizationMap || {})
		userStore.user.setTeamshareOrganizations(organizations || [])
		userStore.account.updateAccount(magicId, {
			organizations: magicOrganizations,
			teamshareOrganizations: organizations,
		})

		// 广播更新账号信息
		BroadcastChannelSender.updateAccount(magicId, {
			organizations: magicOrganizations,
			teamshareOrganizations: organizations,
		})
	}

	/**
	 * @description 设置当前账号组织信息
	 */
	setOrganizationByAccount(params: Organizations) {
		const { organizations = [], magicOrganizationMap = {} } = params

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

		const magicOrganizations = Object.values(magicOrganizationMap)

		magicOrganizations.forEach((item) => {
			if (!item.organization_name) {
				item.organization_name = nameMap?.[item.third_platform_organization_code] ?? ""
			}
			if (!item.organization_logo) {
				item.organization_logo = logoMap?.[item.third_platform_organization_code] ?? ""
			}
		})

		// 数据持久化同步
		const user = new UserRepository()

		user.setOrganizations(magicOrganizationMap ?? {})
		user.setTeamshareOrganizations(organizations ?? [])

		// 内存状态同步
		userStore.user.setOrganizations(magicOrganizationMap || {})
		userStore.user.setTeamshareOrganizations(organizations || [])
	}

	/**
	 * @description 刷新组织信息
	 */
	refreshOrganizations = async (deployCode: string) => {
		const { accounts } = userStore.account
		/** 实时获取当前账号 */
		const userInfo = await this.service.get<UserService>("userService").fetchUserInfo()
		const account = accounts.find((o) => o.magic_id === userInfo?.magic_id)
		if (account) {
			// Step 1: magic中组织体系获取
			const magicOrganizationMap = await this.service
				.get<LoginService>("loginService")
				.magicOrganizationSync(account.deployCode as string, account.access_token)

			// Step 2: 组织同步(先获取再同步)
			const response = await this.service
				.get<LoginService>("loginService")
				.getThirdPlatformOrganization(
					magicOrganizationMap,
					account.access_token,
					deployCode,
				)
			await this.setOrganization(
				{
					magicOrganizationMap,
					organizations: response.organizations,
				},
				userInfo?.magic_id as string,
			)
		}
	}
}
