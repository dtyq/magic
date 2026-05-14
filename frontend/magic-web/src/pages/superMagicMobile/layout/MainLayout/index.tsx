import { Outlet } from "react-router"
import { useCallback } from "react"
import SuperMagicMobileLayout from "../../components/Layout"
import MainHeader from "./components/MainHeader"
import { useNavigate } from "@/routes/hooks/useNavigate"

/**
 * 移动端 SuperMagic 主布局：顶栏 + 子路由内容区。
 * 顶栏返回走浏览器历史栈后退一层；若无可用历史则由 useNavigate 回落到默认路由（移动端为 MobileTabs）。
 */
export default function SuperMagicMobileMainLayout() {
	const navigate = useNavigate()

	/** 顶栏返回：优先 history.go(-1)，与物理返回键语义一致 */
	const onBackClick = useCallback(() => {
		navigate({ delta: -1 })
	}, [navigate])

	return (
		<SuperMagicMobileLayout header={<MainHeader onBackClick={onBackClick} />}>
			<Outlet />
		</SuperMagicMobileLayout>
	)
}
