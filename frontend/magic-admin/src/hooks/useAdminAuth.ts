import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useAdminStore } from "@/stores/admin"
import { checkItemPermission } from "../utils/routeUtils"
import { RoutePath } from "../const/routes"

export function useAdminAuth() {
	const {
		isOfficialOrg,
		userPermissions,
		teamshareUserPermissions,
		currentRouteItems,
		isPermissionInitialized,
		permissionsKeys,
		teamsharePermissionsKeys,
		isPersonalOrganization,
	} = useAdminStore()

	const location = useLocation()
	const { pathname } = location

	const [hasPermission, setHasPermission] = useState<boolean | null>(true)

	useEffect(() => {
		if (!isPermissionInitialized) return

		// 如果当前路径是平台套餐下，且不是官方组织，则设置为无权限
		if (pathname.startsWith(RoutePath.Platform) && !isOfficialOrg) {
			setHasPermission(false)
			return
		}

		// 官方组织不可访问 AI 管理
		if (pathname.startsWith(RoutePath.AI) && isOfficialOrg) {
			setHasPermission(false)
			return
		}

		// 个人组织不可访问企业管理
		if (pathname.startsWith(RoutePath.Enterprise) && isPersonalOrganization) {
			setHasPermission(false)
			return
		}

		// 是否是需要使用天书功能权限的路径
		const isTeamshare =
			(pathname.startsWith(RoutePath.OAApproval) ||
				pathname.startsWith(RoutePath.EnterpriseOrganization)) ??
			false

		/* 路由权限校验 */
		if (currentRouteItems) {
			if (currentRouteItems.validate) {
				const permissions = checkItemPermission(
					currentRouteItems,
					isTeamshare,
					teamshareUserPermissions,
					userPermissions,
				)
				setHasPermission(permissions)
				return
			}
			// 如果路由不需要权限校验，设置为有权限
			setHasPermission(true)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		isPermissionInitialized,
		isOfficialOrg,
		pathname,
		permissionsKeys,
		teamsharePermissionsKeys,
		isPersonalOrganization,
		currentRouteItems,
	])

	return {
		hasPermission,
	}
}
