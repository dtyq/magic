import { useMemo } from "react"
import { Check, Loader2, Plus, ShieldCheck } from "lucide-react"
import dayjs from "@/infrastructure/vendors/dayjs"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import type { SkillPublisherType } from "@/apis/modules/skills"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { normalizeLocale } from "@/utils/locale"
import { formatSkillInstallCount } from "./skill-card-formatters"
import { isOfficialStoreSkillPublisher } from "./skill-publisher"

export type SkillStatus = "added" | "not-added"

export interface SkillCardData {
	id: string
	skillCode: string
	packageName?: string
	name: string
	description: string
	thumbnail?: string
	isFeatured: boolean
	latestVersion?: string
	status: SkillStatus
	authorName?: string
	publisherType?: SkillPublisherType
	needUpgrade?: boolean
	installCount?: number
	updatedAt: string
}

interface SkillCardProps {
	skill: SkillCardData
	isAdding?: boolean
	showFeaturedTag?: boolean
	onAdd?: (id: string) => void
	onOpenDetail?: (skill: SkillCardData) => void
}

function formatSkillUpdatedDateTime(value: string, i18nLanguage: string) {
	const parsed = dayjs(value)
	if (!parsed.isValid()) return value
	const localeTag = normalizeLocale(i18nLanguage).replace("_", "-")
	if (localeTag.startsWith("zh")) return parsed.format("YYYY年M月D日 HH:mm")

	try {
		return new Intl.DateTimeFormat(localeTag, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(parsed.toDate())
	} catch {
		return parsed.format("YYYY-MM-DD HH:mm")
	}
}

function SkillCard({
	skill,
	isAdding = false,
	showFeaturedTag = false,
	onAdd,
	onOpenDetail,
}: SkillCardProps) {
	const { t, i18n } = useTranslation("crew/market")
	const isAdded = skill.status === "added"
	const isOfficialPublisher = isOfficialStoreSkillPublisher(skill.publisherType)
	const sourceLabel = skill.publisherType
		? skill.publisherType === "OFFICIAL_BUILTIN"
			? t("employeeCard.officialBuiltin")
			: isOfficialPublisher
				? t("skillsLibrary.official")
				: t("skillsLibrary.community")
		: null
	const actionLabel = isAdding
		? t("skillsLibrary.adding")
		: isAdded
			? t("skillsLibrary.added")
			: t("skillsLibrary.addToMySkills")
	const updatedAtValue = useMemo(
		() => formatSkillUpdatedDateTime(skill.updatedAt, i18n.language),
		[skill.updatedAt, i18n.language],
	)
	const installCount = formatSkillInstallCount(skill.installCount, i18n.language)
	const showInstallCount = skill.publisherType !== "OFFICIAL_BUILTIN"

	return (
		<article
			className="group relative flex h-full min-h-[148px] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_8px_26px_rgba(24,25,29,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_12px_30px_rgba(24,25,29,0.07)]"
			data-guide-anchor={HomeOnboardingAnchor.SkillMarketCard}
			data-testid="skill-card"
		>
			<div
				role="button"
				tabIndex={0}
				className="flex h-full w-full flex-1 cursor-pointer flex-col gap-3.5 rounded-2xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5"
				onClick={() => onOpenDetail?.(skill)}
				onKeyDown={(event) => {
					if (event.key !== "Enter" && event.key !== " ") return
					event.preventDefault()
					onOpenDetail?.(skill)
				}}
				aria-label={skill.name}
				data-testid="skill-card-detail-button"
			>
				<div className="flex min-w-0 items-start gap-3">
					<SkillThumbnail
						src={skill.thumbnail}
						alt={skill.name}
						iconSize={40}
						className="relative size-10 shrink-0 rounded-xl border-0 bg-muted/40 transition-transform duration-200 group-hover:scale-[1.03]"
						resetKey={skill.id}
						data-testid="skill-card-thumbnail"
					/>
					<div className="min-w-0 flex-1 pr-10">
						<p
							className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground"
							data-testid="skill-card-name"
						>
							{skill.name}
						</p>
						{sourceLabel || showFeaturedTag ? (
							<div className="mt-1 flex min-w-0 items-center gap-2">
								{sourceLabel ? (
									<div
										className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
										data-testid="skill-card-source-badge"
									>
										<ShieldCheck className="size-3" aria-hidden="true" />
										<span>{sourceLabel}</span>
									</div>
								) : null}
								{showFeaturedTag ? (
									<Badge
										variant="outline"
										className="shrink-0 rounded-md border-transparent bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 hover:bg-orange-500/10 dark:text-orange-300"
										data-testid="skill-card-featured"
									>
										{t("skillsLibrary.featured")}
									</Badge>
								) : null}
							</div>
						) : null}
					</div>
				</div>

				<SmartTooltip
					elementType="div"
					maxLines={2}
					className="min-h-[2.75rem] text-[13px] leading-[1.65] text-muted-foreground transition-colors duration-200 group-hover:text-foreground/90"
					content={skill.description}
					sideOffset={4}
				>
					{skill.description}
				</SmartTooltip>

				<div className="mt-auto flex min-w-0 items-center justify-between gap-4">
					{showInstallCount && installCount ? (
						<div
							className="flex min-h-7 min-w-0 flex-col justify-center gap-0.5 leading-tight"
							data-testid="skill-card-install-count"
						>
							<span className="text-[10px] text-muted-foreground/60">
								{t("skillsLibrary.installCountLabel")}
							</span>
							<span className="text-[11px] text-muted-foreground/80">
								{installCount}
							</span>
						</div>
					) : (
						<span aria-hidden="true" />
					)}
					<div
						className="flex min-h-7 min-w-0 flex-col items-end justify-center gap-0.5 text-right leading-tight"
						data-testid="skill-card-updated-at"
					>
						<span className="text-[10px] text-muted-foreground/60">
							{t("skillsLibrary.updatedAtLabel")}
						</span>
						<span className="truncate text-[11px] text-muted-foreground/80">
							{updatedAtValue}
						</span>
					</div>
				</div>
			</div>

			<MagicTooltip title={!isAdded && !isAdding ? actionLabel : undefined}>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className={cn(
						"absolute right-4 top-4 z-10 size-8 rounded-lg",
						isAdded
							? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-100 dark:text-emerald-400"
							: "bg-muted/80 text-foreground/80 hover:bg-muted",
					)}
					disabled={isAdded || isAdding}
					aria-label={actionLabel}
					onClick={() => {
						if (!isAdded && !isAdding) onAdd?.(skill.id)
					}}
					/*
					 * The onboarding tour points at this control for "add to my skills". The design
					 * calls it a full-width footer button; the card ships it as this corner icon,
					 * which is the same action, so the step highlights it here.
					 */
					data-guide-anchor={HomeOnboardingAnchor.SkillMarketCardAdd}
					data-testid={isAdded ? "skill-card-added-button" : "skill-card-add-button"}
				>
					{isAdding ? (
						<Loader2 className="size-4 animate-spin" />
					) : isAdded ? (
						<Check className="size-4" />
					) : (
						<Plus className="size-4" />
					)}
				</Button>
			</MagicTooltip>
		</article>
	)
}

export default observer(SkillCard)
