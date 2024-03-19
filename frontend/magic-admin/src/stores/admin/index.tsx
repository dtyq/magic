import { create } from "zustand"
import type { Route } from "@/routes"
import type { AiManage } from "@/types/aiManage"

interface AdminState {
	/** Maigc用户权限 */
	userPermissions: string[]
	/** 天书功能权限 */
	teamshareUserPermissions: string[]
	/** 是否是官方组织 */
	isOfficialOrg: boolean
	/** 当前组织套餐信息 */
	subscriptionInfo: AiManage.SubscriptionInfo | null
	/** 面包屑 */
	extraBreadcrumb: Array<{
		key: string
		title: React.ReactNode
		path?: string
	}> | null
	/** 侧边栏是否折叠 */
	siderCollapsed: boolean
	/** 权限数据是否已初始化 */
	isPermissionInitialized: boolean
	/** 是否是个人组织 */
	isPersonalOrganization: boolean
	/** 当前路由 */
	currentRouteItems: Route | null
	/** Magic权限key */
	permissionsKeys: string
	/** 天书权限key */
	teamsharePermissionsKeys: string
	setPermissionsKeys: (permissionsKeys: string) => void
	setTeamsharePermissionsKeys: (teamsharePermissionsKeys: string) => void
	setUserPermissions: (permissions: string[]) => void
	setTeamshareUserPermissions: (permissions: string[]) => void
	setIsOfficialOrg: (isOfficialOrg: boolean) => void
	setSubscriptionInfo: (subscriptionInfo: AiManage.SubscriptionInfo | null) => void
	setExtraBreadcrumb: (
		items: Array<{ key: string; title: React.ReactNode; path?: string }> | null,
	) => void
	setSiderCollapsed: (collapsed: boolean) => void
	setIsPermissionInitialized: (initialized: boolean) => void
	setCurrentRouteItems: (routeItems: Route | null) => void
	setIsPersonalOrganization: (isPersonalOrganization: boolean) => void
}

export const useAdminStore = create<AdminState>((set) => ({
	userPermissions: [],
	teamshareUserPermissions: [],
	extraBreadcrumb: [],
	isOfficialOrg: false,
	subscriptionInfo: null,
	siderCollapsed: false,
	/* 权限数据是否已初始化 */
	isPermissionInitialized: false,
	currentRouteItems: null,
	permissionsKeys: "",
	teamsharePermissionsKeys: "",
	isPersonalOrganization: false,
	setPermissionsKeys: (permissionsKeys) => set({ permissionsKeys }),
	setTeamsharePermissionsKeys: (teamsharePermissionsKeys) => set({ teamsharePermissionsKeys }),
	setUserPermissions: (permissions) => set({ userPermissions: permissions }),
	setTeamshareUserPermissions: (permissions) => set({ teamshareUserPermissions: permissions }),
	setExtraBreadcrumb: (items) => set({ extraBreadcrumb: items }),
	setIsOfficialOrg: (isOfficialOrg) => set({ isOfficialOrg }),
	setSubscriptionInfo: (subscriptionInfo) => set({ subscriptionInfo }),
	setSiderCollapsed: (collapsed) => set({ siderCollapsed: collapsed }),
	setIsPermissionInitialized: (initialized: boolean) =>
		set({ isPermissionInitialized: initialized }),
	setCurrentRouteItems: (routeItems) => set({ currentRouteItems: routeItems }),
	setIsPersonalOrganization: (isPersonalOrganization: boolean) => set({ isPersonalOrganization }),
}))
