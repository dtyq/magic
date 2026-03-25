import { useMemo } from "react"
import { Bot } from "lucide-react"
import { MagiClaw, Skills } from "@/enhance/lucide-react"
import { RouteName } from "@/routes/constants"
import type { SidebarMarketMenuItem } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useSidebarMarketMenuItems.types"

export function useSidebarMarketMenuItems() {
	return useMemo<SidebarMarketMenuItem[]>(() => {
		return [
			{
				titleKey: "sidebar:crewMarket.title",
				routeName: RouteName.CrewMarket,
				testId: "sidebar-content-crew-market-button",
				Icon: Bot,
			},
			{
				titleKey: "sidebar:superLobster.title",
				routeName: RouteName.MagiClaw,
				testId: "sidebar-content-magic-claw-button",
				Icon: MagiClaw,
			},
			{
				titleKey: "sidebar:skillsLibrary.title",
				routeName: RouteName.CrewMarketSkills,
				testId: "sidebar-content-skills-library-button",
				Icon: Skills,
			},
		]
	}, [])
}
