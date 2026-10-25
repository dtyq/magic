import type { ComponentType } from "react"
import { useState } from "react"
import { useMemoizedFn, useMount } from "ahooks"
import { useAdminStore } from "@admin/stores/admin"
import { useApis } from "@admin/apis"
import { PERMISSION_KEY_MAP } from "@admin/const/common"

export interface AuthMiddlewareProps {
	className?: string
}

export interface AuthMiddlewareInjectedProps {
	authLoading?: boolean
}

/**
 * 鉴权中间件 HOC
 * 用于包装需要权限校验的组件
 *
 * @param WrappedComponent - 需要包装的组件
 * @param options - 配置选项
 * @returns 包装后的组件
 * ```
 */
export function withAuthMiddleware<P extends object>(
	WrappedComponent: ComponentType<P & AuthMiddlewareInjectedProps>,
) {
	return function AuthMiddleware(
		props: Omit<P, keyof AuthMiddlewareInjectedProps> & AuthMiddlewareProps,
	) {
		const { AIManageApi, SecurityApi } = useApis()
		const {
			isPermissionInitialized,
			setIsOfficialOrg,
			setUserPermissions,
			setIsPermissionInitialized,
			setPermissionsKeys,
			setIsPersonalOrganization,
		} = useAdminStore()

		const [loading, setLoading] = useState(!isPermissionInitialized)

		// 获取权限数据（并行请求以缩短加载时间）
		const getAuthorizedPermission = useMemoizedFn(async () => {
			setLoading(true)
			try {
				const [officialOrgRes, permissionRes] = await Promise.all([
					AIManageApi.isOfficialOrg(),
					SecurityApi.getMyPermissionList(),
				])
				const isOfficial =
					officialOrgRes.is_official ||
					permissionRes.permission_key.includes(
						PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS,
					)
				setIsOfficialOrg(isOfficial)

				const isPersonal = permissionRes.permission_key.includes(
					PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS,
				)
				setIsPersonalOrganization(isPersonal)

				setUserPermissions(permissionRes.permission_key)
				setPermissionsKeys(permissionRes.permission_key.sort().join(","))
			} catch (error) {
				console.error(error)
			} finally {
				setIsPermissionInitialized(true)
				setLoading(false)
			}
		})

		useMount(() => {
			getAuthorizedPermission()
		})

		return <WrappedComponent {...(props as P)} authLoading={loading} />
	}
}
