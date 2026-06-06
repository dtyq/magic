import { Bot, Mic, type LucideIcon } from "lucide-react"
import { MagiClaw, Skills } from "@/enhance/lucide-react"
import { RouteName } from "@/routes/constants"
import type { SidebarMarketMenuItem } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useSidebarMarketMenuItems.types"

export const BASE_MARKET_MENU_ITEMS: SidebarMarketMenuItem[] = [
	{
		titleKey: "sidebar:audioRecordings.title",
		routeName: RouteName.AudioRecordings,
		testId: "sidebar-content-audio-recordings-button",
		Icon: Mic,
	},
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
]
