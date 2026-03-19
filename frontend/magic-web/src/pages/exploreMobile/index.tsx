import { memo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"

// Styles
import { useStyles } from "./styles"

// Hooks
import { useExplorePageMobile } from "./hooks/useExplorePageMobile"

// Components
import AssistantGrid from "./components/AssistantGrid"
import SectionHeader from "./components/SectionHeader"
import MagicNavBar from "@/components/base-mobile/MagicNavBar"
import useNavigate from "@/routes/hooks/useNavigate"
import AssistantPopup from "./components/AssistantPopup"
import MagicSafeArea from "@/components/base/MagicSafeArea"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { botStore } from "@/stores/bot"

/**
 * ExplorePageMobile - Mobile explore page
 *
 * Display AI assistant card list
 *
 * @param props - Component props
 * @returns JSX.Element
 */
function ExplorePageMobile() {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const { selectedAssistant, orgBots, handlers } = useExplorePageMobile()

	const navigate = useNavigate()

	// 刷新助手列表
	const handleRefreshAssistants = useMemoizedFn(async () => {
		await botStore.fetchOrgBotList({ page: 1, pageSize: 100 })
	})

	// const handleSearch = useMemoizedFn(() => {
	// 	navigate(RoutePathMobile.ExploreSearch)
	// })

	return (
		<div className={styles.wrapper}>
			<MagicNavBar
				onBack={() =>
					navigate({
						delta: -1,
						viewTransition: false,
					})
				}
			// right={
			// 	<MagicIcon component={IconSearch} color="currentColor" onClick={handleSearch} />
			// }
			>
				<span className={styles.title}>{t("explore.assistantMarket")}</span>
			</MagicNavBar>
			<MagicPullToRefresh
				height="calc(100% - 48px)"
				onRefresh={handleRefreshAssistants}
				showSuccessMessage={false}
			>
				<div className={styles.container}>
					{/* Section Header */}
					<SectionHeader
						title={t("explore.promptsTitle.innerAssistant")}
						subtitle={t("explore.promptsDesc.innerAssistant")}
						viewAllText={t("explore.buttonText.moreAll")}
					// onViewAll={handlers.handleViewAll}
					/>

					{/* Assistant Grid */}
					<AssistantGrid
						data={[orgBots]}
						onAssistantClick={handlers.handleAssistantClick}
					/>
				</div>
			</MagicPullToRefresh>
			<MagicSafeArea position="bottom" style={{ background: "#ffffff" }} />

			<AssistantPopup
				visible={!!selectedAssistant}
				onClose={handlers.handleCloseAssistantPopup}
				assistant={selectedAssistant}
				onAddAssistant={handlers.handleAddAssistant}
			/>
		</div>
	)
}

const ExplorePageMobileWithObserver = memo(observer(ExplorePageMobile))
ExplorePageMobileWithObserver.displayName = "ExplorePageMobile"

export default ExplorePageMobileWithObserver
