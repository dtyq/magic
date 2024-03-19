import { useMemoizedFn } from "ahooks"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { cva } from "class-variance-authority"
import { type ModeItem, TopicMode } from "../../../../pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { IconMore, IconBackground } from "./icons"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"
import TopicModeTab from "./components/TopicModeTab"
import { cn } from "@/opensource/lib/utils"
import { GuideTourElementId } from "@/opensource/pages/superMagic/components/LazyGuideTour"

const AgentDesigner = lazy(() => import("../../../AgentDesigner"))

// Style variants using CVA for desktop
const moreButtonVariants = cva(
	"flex h-full cursor-pointer flex-col items-center gap-2 rounded-lg px-2 pb-0 pt-2 transition-colors hover:bg-accent/50",
)

const moreButtonIconWrapperVariants = cva("relative")

const moreButtonIconVariants = cva(
	"relative z-[1] flex h-[50px] w-[50px] items-center justify-center",
)

const moreButtonIconBackgroundVariants = cva(
	"absolute left-0 top-0 flex h-full w-full items-center justify-center",
)

const moreButtonTitleVariants = cva(
	"overflow-hidden text-ellipsis text-center text-sm font-normal leading-5 text-[color:var(--magic-color-text-1)]",
)

interface TopicModeTabsDesktopProps {
	activeMode: string
	modeList: ModeItem[]
	onModeChange: (mode: TopicMode) => void
}

function TopicModeTabsDesktop({ activeMode, modeList, onModeChange }: TopicModeTabsDesktopProps) {
	const { t } = useTranslation("super")
	const [agentDesignerVisible, setAgentDesignerVisible] = useState(false)
	const tabsWrapperRef = useRef<HTMLDivElement>(null)

	// Check if activeMode is in frequentModeList, if not set to first
	useEffect(() => {
		if (modeList.length > 0) {
			const isActiveModeInFrequentList = modeList.some(
				(tab) => tab.mode.identifier === activeMode,
			)

			if (!isActiveModeInFrequentList) {
				const firstFrequentMode = modeList[0].mode.identifier as TopicMode
				onModeChange(firstFrequentMode)
			}
		}
	}, [activeMode, modeList, onModeChange])

	// Handle mode change
	const handleModeChange = useMemoizedFn((mode: TopicMode) => {
		onModeChange(mode)
	})

	const handleAgentDesignerClose = useMemoizedFn(() => {
		superMagicModeService.fetchModeList()
	})

	// Scroll to selected tab within container only, without affecting page scroll
	useEffect(() => {
		if (!tabsWrapperRef.current || !activeMode) return

		const container = tabsWrapperRef.current
		const activeTabElement = container.querySelector(
			`[data-testid="topic-mode-tab-${activeMode}"]`,
		) as HTMLElement

		if (activeTabElement) {
			// Calculate scroll position to center the tab within container
			const containerWidth = container.clientWidth
			const tabLeft = activeTabElement.offsetLeft
			const tabWidth = activeTabElement.offsetWidth
			const scrollLeft = tabLeft - containerWidth / 2 + tabWidth / 2

			container.scrollTo({
				left: scrollLeft,
				behavior: "smooth",
			})
		}
	}, [activeMode, modeList])

	return (
		<div
			className="mb-2.5 flex min-h-[100px] w-full flex-nowrap items-stretch justify-center gap-6 px-5"
			data-testid="topic-mode-tabs"
			id={GuideTourElementId.TopicModeTabs}
		>
			<div
				ref={tabsWrapperRef}
				className="scrollbar-x-thin flex h-full flex-grow-0 items-stretch gap-2 overflow-x-auto"
			>
				{modeList.map((tab: ModeItem) => (
					<TopicModeTab
						key={tab.mode.identifier}
						tab={tab}
						isActive={activeMode === tab.mode.identifier}
						onModeChange={handleModeChange}
					/>
				))}
			</div>
			<div className="flex h-full items-center justify-center self-center before:h-10 before:w-0.5 before:bg-[color:var(--magic-color-border)] before:content-['']" />
			<div
				className={cn(moreButtonVariants())}
				onClick={() => setAgentDesignerVisible?.(true)}
				data-testid="topic-mode-more-button"
			>
				<div className={cn(moreButtonIconWrapperVariants())}>
					<div className={cn(moreButtonIconVariants())}>
						<IconMore />
					</div>
					<div
						className={cn(moreButtonIconBackgroundVariants())}
						style={{ color: "rgba(46, 47, 56, 0.05)" }}
					>
						<IconBackground />
					</div>
				</div>
				<div className={cn(moreButtonTitleVariants())}>{t("ui.moreAgents")}</div>
			</div>
			{agentDesignerVisible && (
				<Suspense fallback={null}>
					<AgentDesigner
						agentDesignerVisible={agentDesignerVisible}
						setAgentDesignerVisible={setAgentDesignerVisible}
						onClose={handleAgentDesignerClose}
					/>
				</Suspense>
			)}
		</div>
	)
}

export default TopicModeTabsDesktop
