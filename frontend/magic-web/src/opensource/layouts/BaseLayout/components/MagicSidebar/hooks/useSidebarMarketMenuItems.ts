import { useMemo } from "react"
import { MagiClaw } from "@/opensource/enhance/lucide-react"
import { RouteName } from "@/opensource/routes/constants"
import type { SidebarMarketMenuItem } from "./useSidebarMarketMenuItems.types"

export function useSidebarMarketMenuItems() {
	return useMemo<SidebarMarketMenuItem[]>(() => {
		return [
			{
				titleKey: "sidebar:superLobster.title",
				routeName: RouteName.MagiClaw,
				testId: "sidebar-content-magic-claw-button",
				Icon: MagiClaw,
			},
		]
	}, [])
}
