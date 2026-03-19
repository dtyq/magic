import { Outlet } from "react-router"
import SuperMagicMobileLayout from "../../components/Layout"
import MainHeader from "./components/MainHeader"
import { useCallback } from "react"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import superMagicService from "@/pages/superMagic/services"

export default () => {
	const onBackClick = useCallback(() => {
		superMagicService.navigateToHome(workspaceStore.selectedWorkspace?.id)
	}, [])

	return (
		<SuperMagicMobileLayout header={<MainHeader onBackClick={onBackClick} />}>
			<Outlet />
		</SuperMagicMobileLayout>
	)
}
