import { makeAutoObservable } from "mobx"
import type { User } from "@/types/user"
import { platformKey } from "@/utils/storage"
import { keyBy } from "lodash-es"

export class UserStore {
	authorization: string | null = localStorage.getItem(platformKey("store:authentication"))

	userInfo: User.UserInfo | null = null

	organizations: User.UserOrganization[] = []

	/** magic 组织 Code */
	organizationCode: string = ""

	/** teamshare 组织 Code */
	teamshareOrganizationCode: string = ""

	magicOrganizationMap: Record<string, User.MagicOrganization> = {}

	/** 是否是管理员 */
	isAdmin: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setAuthorization = (authCode: string | null) => {
		this.authorization = authCode
	}

	setUserInfo = (userInfo: User.UserInfo | null) => {
		this.userInfo = userInfo
	}

	setOrganizationCode = (organizationCode: string) => {
		this.organizationCode = organizationCode
	}

	setTeamshareOrganizationCode = (teamshareOrganizationCode: string) => {
		this.teamshareOrganizationCode = teamshareOrganizationCode
	}

	setOrganizations = (organizations: Record<string, User.MagicOrganization>) => {
		this.magicOrganizationMap = organizations
	}

	setTeamshareOrganizations = (organizations: User.UserOrganization[]) => {
		this.organizations = organizations
	}

	// 这里需要做的是设置麦吉组织同步天书组织，设置天书组织同步麦吉组织

	/**
	 * @description 根据 magic 组织 Code 获取组织对象
	 * @param {string} organizationCode magic体系的组织Code
	 */
	getOrganizationByMagic = (organizationCode: string) => {
		const { organizations, magicOrganizationMap } = this
		const orgMap = keyBy(organizations, "organization_code")
		// 获取 teamshare 组织 Code
		return orgMap?.[
			magicOrganizationMap?.[organizationCode]?.third_platform_organization_code ?? ""
		]
	}

	/**
	 * @description 获取当前账号所处组织信息 非 React 场景使用
	 * @return {User.UserOrganization | undefined}
	 */
	getOrganization = (): User.UserOrganization | null => {
		const { organizations, organizationCode, magicOrganizationMap, teamshareOrganizationCode } =
			this
		// 获取组织映射
		const orgMap = keyBy(organizations, "organization_code")
		let org = null
		// 根据 magic 组织 Code 尝试获取组织
		if (organizationCode) {
			org =
				orgMap?.[
					magicOrganizationMap?.[organizationCode]?.third_platform_organization_code ?? ""
				]
		}
		if (!org && teamshareOrganizationCode) {
			org = orgMap?.[teamshareOrganizationCode]
		}
		return org
	}
}

export const userStore = new UserStore()
