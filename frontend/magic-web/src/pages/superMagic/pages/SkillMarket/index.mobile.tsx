import SkillsLibraryMobile from "./components/SkillsLibraryMobile"
import { SKILL_MARKET_TAB_VALUES } from "./components/SkillMarketTabs"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

export default function SkillMarketMobilePage() {
	const navigate = useNavigate()

	return (
		<SkillsLibraryMobile
			activeTab={SKILL_MARKET_TAB_VALUES.skills}
			onTabChange={(value) => {
				if (value === SKILL_MARKET_TAB_VALUES.crew)
					navigate({ name: RouteName.CrewMarketCrew })
				if (value === SKILL_MARKET_TAB_VALUES.connectors)
					navigate({ name: RouteName.CrewMarketMcp })
			}}
		/>
	)
}
