import type { NavigateProps } from "react-router"
import { useAdmin } from "@/provider/AdminProvider"
/**
 * 兼容 Keewood-web 项目，router v5 的 旧版组件
 * @description 使用 AdminProvider 中的 Navigate 组件（如果提供）
 */
export function Navigate(props: NavigateProps) {
	const { Navigate: AdminNavigate } = useAdmin()

	return AdminNavigate ? <AdminNavigate {...props} /> : null
}
