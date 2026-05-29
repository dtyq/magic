import { useState, useEffect, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useAdminStore } from "@admin/stores/admin"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import { RoutePath } from "@admin/const/routes"
import { checkItemPermission } from "../utils/routeUtils"
import { useAdmin } from "@admin/provider/AdminProvider"

export function useAdminAuth() {
	const {
		isOfficialOrg,
		userPermissions,
		currentRouteItems,
		isPermissionInitialized,
		permissionsKeys,
		isPersonalOrganization,
	} = useAdminStore()

	const { env } = useAdmin()
	const location = useLocation()
	const { pathname } = location

	const isSaas = env.MAGIC_APP_ENV.startsWith("saas")
	const [hasPermission, setHasPermission] = useState<boolean | null>(true)

	/** 个人组织不可访问的路由（商业版 AI 路径，RoutePath 已迁至 enterprise） */
	const isPersonalOrgRestrictedAIPath = useMemo(() => {
		return pathname.startsWith("/admin/ai/model") || pathname.startsWith("/admin/ai/usage")
	}, [pathname])

	/** 官方组织不可访问的路由 */
	const isOfficialOrgRestrictedAIPath = useMemo(() => {
		return pathname.startsWith(RoutePath.AICustomModel)
	}, [pathname])

	useEffect(() => {
		if (!isPermissionInitialized) return

		if (pathname.startsWith(RoutePath.PlatformProviderAccess) && !isSaas) {
			setHasPermission(false)
			return
		}

		// 如果当前路径是平台套餐下，且不是官方组织，则设置为无权限
		if (pathname.startsWith(RoutePath.Platform) && !isOfficialOrg) {
			setHasPermission(false)
			return
		}

		// 官方组织不可访问的路由
		if (isOfficialOrg && isOfficialOrgRestrictedAIPath) {
			setHasPermission(false)
			return
		}

		// 个人组织不可访问的路由
		if (isPersonalOrganization && isPersonalOrgRestrictedAIPath) {
			setHasPermission(false)
			return
		}

		/* 路由权限校验 */
		if (currentRouteItems) {
			if (currentRouteItems.validate) {
				const hasAllPermissions =
					userPermissions.includes(PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS) ||
					userPermissions.includes(PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS) ||
					userPermissions.includes(PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS)
				const permissions = checkItemPermission(
					currentRouteItems,
					userPermissions,
					hasAllPermissions,
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
		isPersonalOrganization,
		isPersonalOrgRestrictedAIPath,
		isOfficialOrgRestrictedAIPath,
		currentRouteItems,
		isSaas,
	])

	return {
		hasPermission,
	}
}
