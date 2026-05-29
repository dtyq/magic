import { create } from "zustand"
import { LanguageType, ThemeType } from "@admin-components"
import defaultConfig, { magicUserData, OrganizationType } from "@admin/apis/config"
import { useAdminStore } from "@admin/stores/admin"

export const magicOrganizationMeta = {
	[OrganizationType.Official]: {
		label: "官方组织",
		code: OrganizationType.Official,
	},
	[OrganizationType.Personal]: {
		label: "个人组织",
		code: OrganizationType.Personal,
	},
	[OrganizationType.Enterprise]: {
		label: "企业组织1",
		code: OrganizationType.Enterprise,
	},
	[OrganizationType.Enterprise2]: {
		label: "企业组织2",
		code: OrganizationType.Enterprise2,
	},
	[OrganizationType.Enterprise3]: {
		label: "企业组织3",
		code: OrganizationType.Enterprise3,
	},
	[OrganizationType.Enterprise4]: {
		label: "企业组织4",
		code: OrganizationType.Enterprise4,
	},
}

const createMagicOrganizationConfig = (key: OrganizationType) => {
	const meta = magicOrganizationMeta[key]
	const baseUser = magicUserData.user
	const baseOrganization = magicUserData.organization
	let userInfo = null
	let organizationInfo = null
	let teamshareOrganizationInfo = null

	if (baseUser.userInfo) {
		userInfo = {
			...baseUser.userInfo,
			organization_code: meta.code,
		}
	}

	if (baseOrganization.organizationInfo) {
		organizationInfo = {
			...baseOrganization.organizationInfo,
			organization_name: meta.label,
			magic_organization_code: meta.code,
			third_platform_organization_code: meta.code,
			teamshare_organization_code: meta.code,
		}
	}

	if (baseOrganization.teamshareOrganizationInfo) {
		teamshareOrganizationInfo = {
			...baseOrganization.teamshareOrganizationInfo,
			organization_code: meta.code,
			organization_name: meta.label,
		}
	}

	return {
		label: meta.label,
		user: {
			...baseUser,
			userInfo,
		},
		organization: {
			...baseOrganization,
			organizationCode: meta.code,
			teamshareOrganizationCode: meta.code,
			organizationInfo,
			teamshareOrganizationInfo,
		},
	}
}

const organizationConfigs = {
	[OrganizationType.Official]: createMagicOrganizationConfig(OrganizationType.Official),
	[OrganizationType.Personal]: createMagicOrganizationConfig(OrganizationType.Personal),
	[OrganizationType.Enterprise]: createMagicOrganizationConfig(OrganizationType.Enterprise),
	[OrganizationType.Enterprise2]: createMagicOrganizationConfig(OrganizationType.Enterprise2),
	[OrganizationType.Enterprise3]: createMagicOrganizationConfig(OrganizationType.Enterprise3),
	[OrganizationType.Enterprise4]: createMagicOrganizationConfig(OrganizationType.Enterprise4),
}

interface UserState {
	currentOrganizationKey: OrganizationType
	language: LanguageType
	theme: ThemeType
	refreshKey: number
	organizationConfigs: typeof organizationConfigs
	switchOrganization: (key: OrganizationType) => void
	setLanguage: (language: LanguageType) => void
	setTheme: (theme: ThemeType) => void
}

const resetAdminRuntimeState = () => {
	const adminStore = useAdminStore.getState()
	adminStore.setIsPermissionInitialized(false)
	adminStore.setUserPermissions([])
	adminStore.setPermissionsKeys("")
	adminStore.setSubscriptionInfo(null)
	adminStore.setIsOfficialOrg(false)
}

export const useUserStore = create<UserState>((set) => ({
	currentOrganizationKey: OrganizationType.Official,
	language: LanguageType.zh_CN,
	theme: ThemeType.LIGHT,
	refreshKey: 0,
	organizationConfigs,
	switchOrganization: (key) =>
		set((state) => {
			if (state.currentOrganizationKey === key) {
				return state
			}

			resetAdminRuntimeState()

			return {
				currentOrganizationKey: key,
				refreshKey: state.refreshKey + 1,
			}
		}),
	setLanguage: (language) => set({ language }),
	setTheme: (theme) => set({ theme }),
}))

export const getCurrentUserRuntimeConfig = () => {
	const state = useUserStore.getState()
	return {
		...defaultConfig,
		language: state.language,
		theme: state.theme,
		user: state.organizationConfigs[state.currentOrganizationKey].user,
		organization: state.organizationConfigs[state.currentOrganizationKey].organization,
	}
}
