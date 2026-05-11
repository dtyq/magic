import { useMemo } from "react"
import { Bot, type LucideIcon } from "lucide-react"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { MagiClaw, Skills } from "@/enhance/lucide-react"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { RouteName } from "@/routes/constants"
import type { SidebarMarketMenuItem } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useSidebarMarketMenuItems.types"

export function useSidebarMarketMenuItems() {
	const { isAllowed: canAccessMagicClaw } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.MagicClawAccess,
	)

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
				Icon: MagiClaw as LucideIcon,
			},
			{
				titleKey: "sidebar:skillsLibrary.title",
				routeName: RouteName.CrewMarketSkills,
				testId: "sidebar-content-skills-library-button",
				Icon: Skills as LucideIcon,
			},
		].filter((item) => item.routeName !== RouteName.MagiClaw || canAccessMagicClaw)
	}, [canAccessMagicClaw])
}
