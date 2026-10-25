import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

export const SKILL_MARKET_TAB_VALUES = {
	crew: "crew",
	skills: "skills",
	connectors: "connectors",
} as const

export type SkillMarketTab = (typeof SKILL_MARKET_TAB_VALUES)[keyof typeof SKILL_MARKET_TAB_VALUES]

interface SkillMarketTabsProps {
	value: SkillMarketTab
	onValueChange: (value: SkillMarketTab) => void
	className?: string
	compact?: boolean
}

export default function SkillMarketTabs({
	value,
	onValueChange,
	className,
	compact = false,
}: SkillMarketTabsProps) {
	const { t } = useTranslation("crew/market")

	return (
		<Tabs
			value={value}
			onValueChange={(nextValue) => {
				if (
					nextValue === SKILL_MARKET_TAB_VALUES.crew ||
					nextValue === SKILL_MARKET_TAB_VALUES.skills ||
					nextValue === SKILL_MARKET_TAB_VALUES.connectors
				)
					onValueChange(nextValue)
			}}
			className={cn("min-w-0", className)}
		>
			<TabsList className="h-auto w-fit gap-6 rounded-none bg-transparent p-0">
				<TabsTrigger
					value={SKILL_MARKET_TAB_VALUES.crew}
					className={cn(
						"rounded-none border-0 px-0 font-semibold text-muted-foreground shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
						compact
							? "h-6 text-sm leading-6"
							: "h-8 text-lg leading-8 sm:h-9 sm:text-xl sm:leading-9 lg:h-10 lg:text-2xl lg:leading-10",
					)}
					data-testid="skill-market-crew-tab"
				>
					{t("tabs.digitalEmployees")}
				</TabsTrigger>
				<TabsTrigger
					value={SKILL_MARKET_TAB_VALUES.skills}
					className={cn(
						"rounded-none border-0 px-0 font-semibold text-muted-foreground shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
						compact
							? "h-6 text-sm leading-6"
							: "h-8 text-lg leading-8 sm:h-9 sm:text-xl sm:leading-9 lg:h-10 lg:text-2xl lg:leading-10",
					)}
					data-testid="skill-market-skills-tab"
				>
					{t("tabs.skillsLibrary")}
				</TabsTrigger>
				<TabsTrigger
					value={SKILL_MARKET_TAB_VALUES.connectors}
					className={cn(
						"rounded-none border-0 px-0 font-semibold text-muted-foreground shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
						compact
							? "h-6 text-sm leading-6"
							: "h-8 text-lg leading-8 sm:h-9 sm:text-xl sm:leading-9 lg:h-10 lg:text-2xl lg:leading-10",
					)}
					data-testid="skill-market-connectors-tab"
				>
					{t("tabs.connectors")}
				</TabsTrigger>
			</TabsList>
		</Tabs>
	)
}
