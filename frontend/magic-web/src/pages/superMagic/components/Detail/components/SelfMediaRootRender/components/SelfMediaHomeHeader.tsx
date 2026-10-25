import { Plus, RefreshCw, Settings, Sparkles } from "lucide-react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import type { AICardCreateInitialValues } from "./AICardCreateDialog"
import type { SelfMediaHomeTranslate } from "./SelfMediaHomeTypes"

interface SelfMediaHomeHeaderProps {
	greetingTitle: string
	greetingSubtitle: string
	opening: boolean
	comfortable?: boolean
	onCreateArticle?: () => void
	onOpenBrandConfig?: () => void
	onRefreshAllData?: () => void
	onCreateAICard?: (initialValues?: AICardCreateInitialValues) => void
	t: SelfMediaHomeTranslate
}

function SelfMediaHomeHeader({
	greetingTitle,
	greetingSubtitle,
	opening,
	comfortable = false,
	onCreateArticle,
	onOpenBrandConfig,
	onRefreshAllData,
	onCreateAICard,
	t,
}: SelfMediaHomeHeaderProps) {
	const headerSpacingClass = comfortable ? "pb-6 pt-4" : "pb-5 pt-3"
	const titleClass = comfortable ? "text-[30px] leading-[1.05]" : "text-2xl leading-[1.12]"
	const actionRowClass = comfortable ? "w-auto flex-nowrap gap-3" : "w-full flex-wrap gap-2"
	const iconGroupClass = comfortable ? "h-[54px] gap-2 px-2" : "h-11 gap-1.5 px-1.5"
	const iconButtonClass = comfortable ? "h-10 w-10" : "h-9 w-9"
	const createButtonClass = comfortable
		? "h-[54px] w-auto flex-none rounded-[25px] px-[31px]"
		: "h-11 min-w-0 flex-1 rounded-[22px] px-4"

	return (
		<header
			className={cn(
				"self-media-home-enter-item",
				headerSpacingClass,
				opening && "self-media-home-opening-dim",
			)}
			style={{ animationDelay: "40ms" }}
			data-testid="self-media-home-header"
		>
			<div
				className={cn(
					"flex flex-col gap-4",
					comfortable && "flex-row items-center justify-between",
				)}
			>
				<div className="min-w-0 space-y-1">
					<h2 className={cn("font-[780] tracking-tight text-[#18181b]", titleClass)}>
						{greetingTitle}
					</h2>
					<p
						className={cn(
							"mt-2 text-sm leading-[1.65] text-[#71717a]",
							comfortable && "mt-2.5",
						)}
					>
						{greetingSubtitle}
					</p>
				</div>
				<div className={cn("flex min-w-0 items-center", actionRowClass)}>
					<div
						className={cn(
							"flex shrink-0 items-center rounded-full bg-white/90 shadow-[inset_0_1px_rgba(255,255,255,0.8)]",
							iconGroupClass,
						)}
					>
						{onOpenBrandConfig ? (
							<MagicTooltip title={t("detail.selfMedia.home.brandConfig")}>
								<button
									type="button"
									className={cn(
										"flex items-center justify-center rounded-full text-[#18181b] transition-colors hover:bg-[#18181b] hover:text-[#ffd637]",
										iconButtonClass,
									)}
									onClick={onOpenBrandConfig}
									data-testid="self-media-home-brand-config-button"
								>
									<Settings size={19} />
								</button>
							</MagicTooltip>
						) : null}
						{onRefreshAllData ? (
							<MagicTooltip title={t("detail.selfMedia.refreshAllData")}>
								<button
									type="button"
									className={cn(
										"flex items-center justify-center rounded-full text-[#18181b] transition-colors hover:bg-[#18181b] hover:text-[#ffd637]",
										iconButtonClass,
									)}
									onClick={onRefreshAllData}
									aria-label={t("detail.selfMedia.refreshAllData")}
									data-testid="self-media-home-refresh-all-data-button"
								>
									<RefreshCw size={18} />
								</button>
							</MagicTooltip>
						) : null}
						{onCreateAICard ? (
							<MagicTooltip title={t("detail.selfMedia.home.aiCard")}>
								<button
									type="button"
									className={cn(
										"flex items-center justify-center rounded-full text-[#18181b] transition-colors hover:bg-[#18181b] hover:text-[#ffd637]",
										iconButtonClass,
									)}
									onClick={() => onCreateAICard()}
									data-testid="self-media-home-ai-card-button"
								>
									<Sparkles size={19} />
								</button>
							</MagicTooltip>
						) : null}
					</div>
					{onCreateArticle ? (
						<button
							type="button"
							className={cn(
								"flex min-w-0 items-center justify-center gap-2 bg-[#18181b] font-[800] text-[#ffffff] shadow-[0_18px_34px_rgba(24,24,27,0.18)] transition-transform hover:-translate-y-0.5",
								createButtonClass,
							)}
							onClick={onCreateArticle}
							data-testid="self-media-home-create-button"
						>
							<Plus size={16} className="shrink-0" />
							<span className="min-w-0 truncate">
								{t("detail.selfMedia.home.create")}
							</span>
						</button>
					) : null}
				</div>
			</div>
		</header>
	)
}

export default SelfMediaHomeHeader
