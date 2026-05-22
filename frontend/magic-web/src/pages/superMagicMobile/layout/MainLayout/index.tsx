import { Outlet } from "react-router"
import { useCallback } from "react"
import SuperMagicMobileLayout from "../../components/Layout"
import MainHeader from "./components/MainHeader"
import { useNavigate } from "@/routes/hooks/useNavigate"

/**
 * Mobile SuperMagic layout: header + child routes.
 * Default header back uses history.go(-1); child headers pass fallbackRoute via useNavigate when needed.
 */
export default function SuperMagicMobileMainLayout() {
	const navigate = useNavigate()

	/** Default back: history first; useNavigate falls back to MobileHome when length is insufficient. */
	const onBackClick = useCallback(() => {
		navigate({ delta: -1, viewTransition: false })
	}, [navigate])

	return (
		<SuperMagicMobileLayout header={<MainHeader onBackClick={onBackClick} />}>
			<Outlet />
		</SuperMagicMobileLayout>
	)
}
