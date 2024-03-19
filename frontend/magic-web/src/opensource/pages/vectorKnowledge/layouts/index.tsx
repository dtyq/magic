import { Outlet } from "react-router-dom"
import { RoutePath } from "@/opensource/constants/routes"
import type { PropsWithChildren } from "react"
import { Suspense, useEffect } from "react"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useLocation } from "react-router"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"

interface VectorKnowledgeLayoutProps extends PropsWithChildren {}

export default function VectorKnowledgeLayout({ children }: VectorKnowledgeLayoutProps) {
	const navigate = useNavigate()

	const { pathname } = useLocation()

	// 如果当前路径不是详情页或创建页，则默认跳转到创建页
	useEffect(() => {
		if (
			!pathname.includes(RoutePath.VectorKnowledgeDetail) &&
			!pathname.includes(RoutePath.VectorKnowledgeCreate)
		) {
			navigate({
				name: RouteName.VectorKnowledgeCreate,
			})
		}
	}, [pathname, navigate])

	return <Suspense fallback={<MagicSpin />}>{children || <Outlet />}</Suspense>
}
