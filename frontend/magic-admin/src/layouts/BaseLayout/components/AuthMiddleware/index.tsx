import type { ComponentType } from "react"
import { useState } from "react"
import { useMemoizedFn, useMount } from "ahooks"
import { MagicSpin } from "components"
import { useAdminStore } from "@/stores/admin"
import { useApis } from "@/apis"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { Flex } from "antd"

export interface AuthMiddlewareProps {
	className?: string
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
export function withAuthMiddleware<P extends object>(WrappedComponent: ComponentType<P>) {
	return function AuthMiddleware(props: P & AuthMiddlewareProps) {
		const { AIManageApi, SecurityApi } = useApis()
		const {
			isPermissionInitialized,
			setIsOfficialOrg,
			setUserPermissions,
			setIsPermissionInitialized,
			setPermissionsKeys,
		} = useAdminStore()

		const [loading, setLoading] = useState(!isPermissionInitialized)

		// 获取权限数据（并行请求以缩短加载时间）
		const getAuthorizedPermission = useMemoizedFn(async () => {
			try {
				// 前 4 个请求互不依赖，并行执行
				const [officialOrgRes, permissionRes] = await Promise.all([
					AIManageApi.isOfficialOrg(),

					SecurityApi.getMyPermissionList(),
				])

				const isOfficial =
					officialOrgRes.is_official ||
					permissionRes.permission_key.includes(
						PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS,
					)
				// 是否是官方组织
				setIsOfficialOrg(isOfficial)

				setUserPermissions(permissionRes.permission_key)
				setPermissionsKeys(permissionRes.permission_key.sort().join(","))
			} catch (error) {
				console.error(error)
			} finally {
				setIsPermissionInitialized(true)
				setLoading(false)
			}
		})

		// 只在权限未初始化时执行权限获取
		useMount(() => {
			getAuthorizedPermission()
		})

		// 权限初始化中，显示加载状态
		if (loading) {
			return (
				<Flex justify="center" align="center" style={{ height: "100vh", width: "100vw" }}>
					<MagicSpin spinning />
				</Flex>
			)
		}

		return <WrappedComponent {...props} />
	}
}
