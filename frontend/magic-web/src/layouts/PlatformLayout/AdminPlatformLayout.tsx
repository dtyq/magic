import { Outlet } from "react-router"
import SwitchingOrganizationLoading from "@/components/fallback/SwitchingOrganizationLoading"
import { useOrganizationChangedLoading } from "./hooks/useOrganizationChangedLoading"

export default function AdminPlatformLayout() {
	useOrganizationChangedLoading()

	return (
		<SwitchingOrganizationLoading>
			<Outlet />
		</SwitchingOrganizationLoading>
	)
}
