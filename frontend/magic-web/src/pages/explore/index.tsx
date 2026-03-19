import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { IconMagicBots } from "@/enhance/tabler/icons-react"
import CNLogo from "@/assets/logos/exploreLogo-cn.svg"
import ENLogo from "@/assets/logos/exploreLogo-en.svg"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useEffect, useState, useMemo, lazy } from "react"
import MagicIcon from "@/components/base/MagicIcon"
import useNavigate from "@/routes/hooks/useNavigate"
import MagicButton from "@/components/base/MagicButton"
import type { PromptCard as PromptCardType } from "./components/PromptCard/types"
import PromptDescription from "./components/PromptDescription"
import useStyles from "./useStyles"
import PromptInner from "./components/PromptInner"
import AddOrUpdateAgent from "./components/AddOrUpdateAgent"
import useAssistant from "./hooks/useAssistant"
import Search from "./components/Search"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useExploreData } from "./hooks/useExploreData"
import ExplorePageService from "@/services/explore/ExplorePageService"
import { useGlobalLanguage } from "@/models/config/hooks"
import { RouteName } from "@/routes/constants"

const ExplorePage = observer(function ExplorePage() {
	const { t } = useTranslation("interface")
	const lang = useGlobalLanguage()
	const { styles, cx } = useStyles()
	const navigate = useNavigate()
	const { navigateConversation } = useAssistant()

	// Use custom hook for data management
	const { orgBots, orgBotLoading, handleClickCard, handleAddFriend } = useExploreData()

	const [currentCard, setCurrentCard] = useState<PromptCardType>({} as PromptCardType)
	const [addAgentModalOpen, { setTrue: openAddAgentModal, setFalse: closeAddAgentModal }] =
		useBoolean(false)
	const [expandPanelOpen, { setTrue: openExpandPanel, setFalse: closeExpandPanel }] =
		useBoolean(false)

	// Handle card click with service logic
	const handleCardClick = useMemoizedFn((id: string) => {
		const card = handleClickCard(id)
		if (!card) return
		setCurrentCard(card)
		openExpandPanel()
	})

	// Handle add friend with enhanced logic
	const handleAddFriendWithNavigation = useMemoizedFn(
		async (cardData: PromptCardType, addAgent: boolean, isNavigate: boolean) => {
			const result = await handleAddFriend(cardData, addAgent, isNavigate)

			if (result.success && result.userId) {
				// Navigate to conversation if requested
				if (isNavigate) {
					navigateConversation(result.userId)
				} else if (addAgent) {
					// Update current card state
					setCurrentCard((prev) =>
						ExplorePageService.updateCardAfterAddFriend(prev, result.userId!),
					)
				}
			}
		},
	)

	// Handle escape key to close panel
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" || e.key === "Esc") {
				closeExpandPanel()
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [closeExpandPanel])

	// Logo based on language
	const logo = useMemo(() => {
		if (lang === "en_US") {
			return <img alt="logo" src={ENLogo} />
		}
		return <img alt="logo" src={CNLogo} />
	}, [lang])

	return (
		<Flex className={styles.container}>
			<Flex flex={1} vertical className={styles.inner} gap={20}>
				<Flex gap={20} align="center" className={styles.header}>
					<Flex className={styles.title} gap={10} align="center">
						{logo}
					</Flex>

					<Search handleClickCard={handleCardClick} />

					<Flex gap={10} align="center">
						<MagicButton
							type="text"
							className={styles.button}
							onClick={() => {
								navigate({ name: RouteName.AgentList })
							}}
						>
							{t("explore.buttonText.mangageAssistant")}
						</MagicButton>
						<MagicButton
							type="text"
							className={cx(styles.button, styles.magicColor)}
							icon={<MagicIcon component={IconMagicBots} size={20} color="white" />}
							onClick={openAddAgentModal}
						>
							{t("explore.buttonText.createAssistant")}
						</MagicButton>
					</Flex>
				</Flex>

				{orgBots.length > 0 && (
					<PromptInner
						loading={orgBotLoading}
						cards={orgBots}
						onCardClick={handleCardClick}
					/>
				)}
			</Flex>

			<PromptDescription
				open={expandPanelOpen}
				data={currentCard}
				onClose={closeExpandPanel}
				onAddFriend={handleAddFriendWithNavigation}
			/>
			<AddOrUpdateAgent open={addAgentModalOpen} close={closeAddAgentModal} />
		</Flex>
	)
})

const ExplorePageMobile = lazy(() => import("@/pages/exploreMobile"))

export default () => {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <ExplorePageMobile />
	}

	return <ExplorePage />
}
