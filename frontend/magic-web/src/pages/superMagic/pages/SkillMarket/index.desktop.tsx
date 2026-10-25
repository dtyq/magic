import { useRef } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import GuideTourWrapper from "@/pages/superMagic/components/LazyGuideTour"
import MarketBackToTopButton from "@/pages/superMagic/pages/CrewMarket/components/MarketBackToTopButton"
import SkillsLibrary from "./components/SkillsLibrary"
import { SKILL_MARKET_TAB_VALUES } from "./components/SkillMarketTabs"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

function SkillMarketDesktopPage() {
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const navigate = useNavigate()

	return (
		<>
			<div
				className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
				data-testid="skill-market-page"
			>
				<ScrollArea
					className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block"
					viewportRef={scrollViewportRef}
				>
					<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
						<div className="w-full min-w-0" data-testid="skill-market-content">
							<SkillsLibrary
								marketTabValue={SKILL_MARKET_TAB_VALUES.skills}
								onMarketTabChange={(value) => {
									if (value === SKILL_MARKET_TAB_VALUES.crew)
										navigate({ name: RouteName.CrewMarketCrew })
									if (value === SKILL_MARKET_TAB_VALUES.connectors)
										navigate({ name: RouteName.CrewMarketMcp })
								}}
								scrollViewportRef={scrollViewportRef}
							/>
						</div>
					</div>
				</ScrollArea>
				<MarketBackToTopButton
					viewportRef={scrollViewportRef}
					testId="skill-market-back-to-top"
				/>
			</div>

			{/*
			 * The "了解如何添加/管理技能" tour opens here and comes back to this page for its last step,
			 * so the tour is mounted on the skill library and on "My Skills" alike.
			 */}
			<GuideTourWrapper isMobile={false} page="skill-market" />
		</>
	)
}

export default SkillMarketDesktopPage
