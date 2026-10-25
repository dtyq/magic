import { makeAutoObservable } from "mobx"
import type { User } from "@/types/user"
import { platformKey } from "@/utils/storage"
import { isNumber, isBoolean, keyBy } from "lodash-es"
import type { Admin } from "@/types/admin"
import type { LongMemory } from "@/types/longMemory"
import { isUnlimitedSubscription } from "../utils/subscription"
import { hasMagicAdminPermission, hasTeamshareAdminIdentification } from "../utils/adminAccess"
import { setWatermarkOrganizationType, syncUserWatermark } from "@/utils/watermark"

export class UserStore {
	authorization: string | null = localStorage.getItem(platformKey("store:authentication"))

	userInfo: User.UserInfo | null = null

	organizations: User.UserOrganization[] = []

	/** magic 组织 Code */
	organizationCode: string = ""

	/** teamshare 组织 Code */
	teamshareOrganizationCode: string = ""

	/** 组织列表是否已完成获取 */
	organizationListReady: boolean = false

	/** 组织订阅的套餐信息 */
	organizationSubscriptionInfo: Admin.SubscriptionInfo | null = null

	/** 组织订阅的套餐积分（完整信息） */
	organizationPointsInfo: Admin.OrganizationPoints | null = null

	/** 组织订阅的套餐积分（仅总数，向后兼容） */
	get organizationPoints(): number {
		return (
			this.organizationPointsInfo?.organization_total_points ??
			this.organizationPointsInfo?.total_points ??
			0
		)
	}

	/** 组织订阅的套餐积分是否加载中 */
	get organizationPointsLoading(): boolean {
		return this.organizationPointsInfo === null
	}

	magicOrganizationMap: Record<string, User.MagicOrganization> = {}

	/** 是否是管理员 */
	isAdmin: boolean = false

	/** 当前用户的真实权限 key */
	userPermissions: string[] = []

	/**
	 * 是否展示管理后台入口。
	 * 麦吉组织管理员 / 麦吉后台权限，或当前组织的天书超管、所有者、子管理员、天书后台子权限均可进入。
	 */
	get canAccessAdmin(): boolean {
		return (
			this.isAdmin ||
			hasMagicAdminPermission(this.userPermissions) ||
			hasTeamshareAdminIdentification(this.getOrganization()?.identifications)
		)
	}

	/** 当前组织是否是个人组织 */
	isPersonalOrganization: boolean = false

	/** 当前组织的激活人数 */
	organizationActiveCount: number = 0

	/** 待处理的长期记忆列表 */
	pendingMemoryList: LongMemory.Memory[] = []

	/** 是否是无限制套餐 */
	get isUnlimitedPlan(): boolean {
		return isUnlimitedSubscription(this.organizationSubscriptionInfo)
	}

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * @description 当前组织是否为免费试用版
	 * @return {boolean}
	 */
	get isFreeTrialVersion(): boolean {
		return !this.organizationSubscriptionInfo?.is_paid_plan
	}

	setAuthorization = (authCode: string | null) => {
		this.authorization = authCode
	}

	setUserInfo = (userInfo: User.UserInfo | null) => {
		this.userInfo = userInfo
		syncUserWatermark(userInfo)
		if (!userInfo) {
			this.setIsAdmin(false)
			this.setUserPermissions([])
		}
	}

	setOrganizationCode = (organizationCode: string) => {
		this.organizationCode = organizationCode
	}

	setTeamshareOrganization = (
		teamshareOrganizationCode: string,
		organizations?: User.UserOrganization[],
	) => {
		this.setTeamshareOrganizationCode(teamshareOrganizationCode)

		if (organizations) {
			this.setTeamshareOrganizations(organizations)
		}

		// 根据 organizationCode 获取组织信息，并设置当前组织是否是个人组织
		const organizationsList = organizations ?? this.organizations
		const targetOrganization = organizationsList.find(
			(organization) => organization.organization_code === teamshareOrganizationCode,
		)
		if (targetOrganization) {
			this.setIsPersonalOrganization(targetOrganization.is_personal_organization)
			this.setOrganizationActiveCount(targetOrganization.active_count)
		}
	}

	setTeamshareOrganizationCode = (teamshareOrganizationCode: string) => {
		this.teamshareOrganizationCode = teamshareOrganizationCode
	}

	setOrganizationListReady = (ready: boolean) => {
		this.organizationListReady = ready
	}

	setOrganizations = (organizations: Record<string, User.MagicOrganization>) => {
		this.magicOrganizationMap = organizations
	}

	setTeamshareOrganizations = (organizations: User.UserOrganization[]) => {
		// 个人组织排在最前面
		this.organizations = organizations.sort((a, b) => {
			if (a.is_personal_organization) {
				return -1
			}
			if (b.is_personal_organization) {
				return 1
			}
			return 0
		})
	}

	setIsAdmin = (isAdmin: boolean) => {
		this.isAdmin = isAdmin
	}

	setUserPermissions = (permissions: string[]) => {
		this.userPermissions = Array.from(new Set(permissions))
	}

	setOrganizationSubscriptionInfo = (
		organizationSubscriptionInfo: Admin.SubscriptionInfo | null,
	) => {
		this.organizationSubscriptionInfo = organizationSubscriptionInfo
	}

	setOrganizationPoints = (organizationPoints: number | Admin.OrganizationPoints) => {
		if (isNumber(organizationPoints)) {
			// 向后兼容：如果传入的是数字，更新 organizationPointsInfo
			if (this.organizationPointsInfo) {
				this.organizationPointsInfo = {
					...this.organizationPointsInfo,
					total_points: organizationPoints,
					organization_remaining_points: organizationPoints,
				}
			} else {
				// 如果没有完整信息，创建一个最小对象
				this.organizationPointsInfo = {
					total_points: organizationPoints,
					organization_total_points: organizationPoints,
					organization_remaining_points: null,
					organization_limit_points: null,
					user_limit_points: null,
					user_remaining_points: null,
					expiring_quota_details: [],
					next_cycle_grant: {
						scheduled_at: "",
						points: 0,
						rule_name: "",
						rule_group_name: "",
					},
				}
			}
		} else {
			// 传入完整对象
			this.organizationPointsInfo = organizationPoints
		}
	}

	setIsPersonalOrganization = (isPersonalOrganization: boolean) => {
		if (isBoolean(isPersonalOrganization)) {
			this.isPersonalOrganization = isPersonalOrganization
			setWatermarkOrganizationType(isPersonalOrganization)
		}
	}

	setOrganizationActiveCount = (organizationActiveCount: number) => {
		if (isNumber(organizationActiveCount)) {
			this.organizationActiveCount = organizationActiveCount
		}
	}

	setPendingMemoryList = (pendingMemoryList: LongMemory.Memory[]) => {
		this.pendingMemoryList = pendingMemoryList
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
