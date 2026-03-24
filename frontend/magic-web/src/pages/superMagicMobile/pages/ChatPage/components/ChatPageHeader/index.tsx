import { Menu, Trash, Bot } from "lucide-react"
import { Skills } from "@/enhance/lucide-react"
import { useTranslation } from "react-i18next"
import { globalConfigStore } from "@/stores/globalConfig"
import { SupportLocales } from "@/constants/locale"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

interface ChatPageHeaderProps {
	onMenuClick: () => void
}

export default function ChatPageHeader({ onMenuClick }: ChatPageHeaderProps) {
	const { i18n, t } = useTranslation("sidebar")
	const globalConfig = globalConfigStore.globalConfig
	const navigate = useNavigate()

	function handleSkillsLibraryClick() {
		navigate({ name: RouteName.CrewMarketSkills })
	}

	function handleCrewMarketClick() {
		navigate({ name: RouteName.CrewMarket })
	}

	function handleRecycleBinClick() {
		navigate({ name: RouteName.RecycleBin })
	}

	return (
		<div className="w-full shrink-0 rounded-b-xl bg-background px-2.5 pt-safe-top shadow-xs">
			<div className="flex h-12 w-full items-center gap-2">
				{globalConfig?.minimal_logo && (
					<img
						className="rounded-lg"
						src={globalConfig?.minimal_logo}
						alt={globalConfig?.name_i18n?.[i18n.language as SupportLocales]}
						width={32}
						draggable={false}
					/>
				)}

				{/* 标题 */}
				<div className="min-w-0 flex-1 truncate text-lg font-medium text-foreground">
					{globalConfig?.name_i18n?.[i18n.language as SupportLocales]}
				</div>

				{/* 右侧按钮组 */}
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent active:bg-accent/80"
						onClick={handleCrewMarketClick}
						aria-label={t("crewMarket.title")}
						data-testid="chat-page-header-crew-market-button"
					>
						<Bot size={20} />
					</button>
					<button
						type="button"
						className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent active:bg-accent/80"
						onClick={handleSkillsLibraryClick}
						aria-label={t("skillsLibrary.title")}
						data-testid="chat-page-header-skills-library-button"
					>
						<Skills size={20} />
					</button>
					<button
						type="button"
						className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent active:bg-accent/80"
						onClick={onMenuClick}
						aria-label={t("appsMenu.more")}
						data-testid="chat-page-header-more-button"
					>
						<Menu size={20} />
					</button>
					<button
						type="button"
						className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent active:bg-accent/80"
						onClick={handleRecycleBinClick}
						aria-label={t("footer.recycleBin")}
						data-testid="chat-page-header-recycle-bin-button"
					>
						<Trash size={20} />
					</button>
				</div>
			</div>
		</div>
	)
}
