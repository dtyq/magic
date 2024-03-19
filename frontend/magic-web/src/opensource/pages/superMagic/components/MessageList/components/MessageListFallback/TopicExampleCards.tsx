import { IconRefresh } from "@tabler/icons-react"
import { ArrowUp, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTopicExamples } from "@/opensource/pages/superMagic/components/MessagePanel/components/TopicExamples/hooks/useTopicExamples"
import { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { SupportLocales } from "@/opensource/constants/locale"
import { cn } from "@/opensource/lib/tiptap-utils"
import { isPrivateDeployment } from "@/opensource/utils/env"

interface TopicExampleCardsProps {
	topicMode: TopicMode
	onCardClick: (content: string | object) => void
}

// Color themes for suggestion cards
const CARD_THEMES = [
	{
		bgColor: "bg-orange-50 dark:bg-[#3a1f2d] hover:bg-orange-100 dark:hover:bg-[#3a1f2d]/80",
		arrowColor: "text-orange-500",
	},
	{
		bgColor: "bg-blue-50 dark:bg-[#1a2b3a] hover:bg-blue-100 dark:hover:bg-[#1a2b3a]/80",
		arrowColor: "text-blue-500",
	},
	{
		bgColor: "bg-green-50 dark:bg-[#1f3a1f] hover:bg-green-100 dark:hover:bg-[#1f3a1f]/80",
		arrowColor: "text-green-500",
	},
	{
		bgColor: "bg-purple-50 dark:bg-[#2d1f3a] hover:bg-purple-100 dark:hover:bg-[#2d1f3a]/80",
		arrowColor: "text-purple-500",
	},
	{
		bgColor: "bg-pink-50 dark:bg-[#3a1f2d] hover:bg-pink-100 dark:hover:bg-[#3a1f2d]/80",
		arrowColor: "text-pink-500",
	},
]

function TopicExampleCardsComponent({ topicMode, onCardClick }: TopicExampleCardsProps) {
	const { t, i18n } = useTranslation("super")

	// Use hook to fetch and manage examples
	const { exampleList, refreshExamples, loading } = useTopicExamples({
		topicMode,
		count: 3,
		enabled: true,
	})

	return (
		<>
			{/* Suggestion Cards */}
			{loading ? (
				<div className="flex w-full items-center justify-center py-4 text-sm text-[rgba(28,29,35,0.6)] dark:text-[rgba(255,255,255,0.6)]">
					<Loader2 className="size-4 animate-spin" />
				</div>
			) : exampleList.length > 0 ? (
				<div className="flex flex-col gap-2">
					{exampleList.map((example, index) => {
						const theme = CARD_THEMES[index % CARD_THEMES.length]
						const currentLocale = i18n.language as
							| SupportLocales.zhCN
							| SupportLocales.enUS
						const title = example.title[currentLocale] || example.title.zh_CN
						const content = example.content[currentLocale] || example.content.zh_CN

						return (
							<div
								key={`${example.id}-${index}`}
								className={cn(
									`box-border flex w-full cursor-pointer items-center gap-1 rounded-lg ${theme.bgColor} px-2.5 py-2 text-[#1c1d23] transition-opacity duration-200 hover:opacity-90 active:opacity-80 dark:text-white`,
								)}
								onClick={() => onCardClick(content)}
							>
								<span className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-normal leading-5 text-[#1c1d23] dark:text-white">
									{title}
								</span>
								<div
									className={`flex h-5 w-5 flex-shrink-0 items-center justify-center ${theme.arrowColor}`}
								>
									<ArrowUp size={20} />
								</div>
							</div>
						)
					})}
				</div>
			) : null}

			{/* Refresh Button */}
			{!loading && exampleList.length > 0 && (
				<div
					className="flex cursor-pointer items-center gap-1 py-2 text-sm font-normal text-[rgba(28,29,35,0.6)] transition-colors duration-200 hover:text-[rgba(28,29,35,0.8)] dark:text-[rgba(255,255,255,0.6)] dark:hover:text-[rgba(255,255,255,0.8)]"
					onClick={refreshExamples}
				>
					<IconRefresh size={16} />
					<span>{t("superMagicMessageListFallback.refreshButton")}</span>
				</div>
			)}

			<style>{`
				@keyframes shake {
					0% { transform: rotate(-10deg); }
					25% { transform: rotate(10deg); }
					50% { transform: rotate(0deg); }
					75% { transform: rotate(-10deg); }
					100% { transform: rotate(-10deg); }
				}
			`}</style>
		</>
	)
}

const TopicExampleCards = (props: TopicExampleCardsProps) => {
	if (isPrivateDeployment()) {
		return null
	}

	return <TopicExampleCardsComponent {...props} />
}

export default TopicExampleCards
