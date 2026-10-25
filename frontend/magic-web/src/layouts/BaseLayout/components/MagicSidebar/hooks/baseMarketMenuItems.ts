import { Mic, Palette, Presentation, UsersRound, type LucideIcon } from "lucide-react"
import { MagiClaw, Skills } from "@/enhance/lucide-react"
import { RouteName } from "@/routes/constants"
import type { SidebarMarketMenuItem } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useSidebarMarketMenuItems.types"

export const BASE_MARKET_MENU_ITEMS: SidebarMarketMenuItem[] = [
	{
		titleKey: "sidebar:slidesTemplates.title",
		routeName: RouteName.SuperSlidesTemplates,
		activeRouteNames: [RouteName.SuperSlidesTemplates, RouteName.SuperSlidesTemplatesLegacy],
		testId: "sidebar-content-slides-templates-button",
		Icon: Presentation,
	},
	{
		titleKey: "sidebar:audioRecordings.title",
		routeName: RouteName.AudioRecordings,
		activeRouteNames: [RouteName.AudioRecordings, RouteName.AudioRecordingDetail],
		testId: "sidebar-content-audio-recordings-button",
		Icon: Mic,
	},
	{
		titleKey: "sidebar:aiCanvas.title",
		routeName: RouteName.AiCanvas,
		activeRouteNames: [RouteName.AiCanvas, RouteName.AiCanvasProjectState],
		testId: "sidebar-content-ai-canvas-button",
		Icon: Palette,
	},
	{
		titleKey: "sidebar:personaResearch.title",
		routeName: RouteName.PersonaResearch,
		activeRouteNames: [
			RouteName.PersonaResearch,
			RouteName.PersonaResearchPersonas,
			RouteName.PersonaResearchTemplates,
			RouteName.PersonaResearchStudies,
			RouteName.PersonaResearchStudy,
		],
		testId: "sidebar-content-persona-research-button",
		Icon: UsersRound,
	},
	{
		titleKey: "sidebar:superLobster.title",
		routeName: RouteName.MagiClaw,
		activeRouteNames: [RouteName.MagiClaw, RouteName.ClawPlayground],
		testId: "sidebar-content-magic-claw-button",
		Icon: MagiClaw as LucideIcon,
	},
	{
		titleKey: "sidebar:skillsLibrary.title",
		routeName: RouteName.CrewMarketCrew,
		activeRouteNames: [
			RouteName.CrewMarket,
			RouteName.CrewMarketCrew,
			RouteName.CrewMarketSkills,
			RouteName.CrewMarketMcp,
			RouteName.CrewEdit,
			RouteName.SkillEdit,
			RouteName.MySkills,
			RouteName.MyCrew,
			RouteName.CrewConversation,
		],
		testId: "sidebar-content-skills-library-button",
		Icon: Skills as LucideIcon,
	},
]
