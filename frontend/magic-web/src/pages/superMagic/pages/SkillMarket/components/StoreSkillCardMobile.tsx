import { useMemo } from "react"
import dayjs from "@/infrastructure/vendors/dayjs"
import { CircleUserRound, ShieldCheck } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import { normalizeLocale } from "@/utils/locale"
import { formatSkillInstallCount } from "./skill-card-formatters"
import { isOfficialStoreSkillPublisher, resolveStoreSkillPublisherLabel } from "./skill-publisher"

interface StoreSkillCardMobileProps {
	skill: StoreSkillView
	language: string
	showFeaturedTag?: boolean
	onAdd?: (id: string) => void
	onOpenDetail?: (skill: StoreSkillView) => void
}

function formatSkillUpdatedDateTime(value: string, i18nLanguage: string) {
	const parsed = dayjs(value)
	if (!parsed.isValid()) return value
	const localeTag = normalizeLocale(i18nLanguage).replace("_", "-")

	try {
		return new Intl.DateTimeFormat(localeTag, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(parsed.toDate())
	} catch {
		return parsed.format("YYYY-MM-DD HH:mm")
	}
}

function normalizeDisplayText(value?: string | null) {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return null
	return normalizedValue
}

export const StoreSkillCardMobile = observer(function StoreSkillCardMobile({
	skill,
	language,
	showFeaturedTag = false,
	onAdd,
	onOpenDetail,
}: StoreSkillCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const publisherLabel = resolveStoreSkillPublisherLabel({
		authorName: skill.authorName,
		publisherType: skill.publisherType,
		t,
		fallbackLabel: t("skillsLibrary.authorFallback"),
	})
	const isOfficialPublisher = isOfficialStoreSkillPublisher(skill.publisherType)
	const packageNameLabel = normalizeDisplayText(skill.packageName)
	const latestVersionLabel = normalizeDisplayText(skill.latestVersion)
	const updatedAtValue = useMemo(
		() => formatSkillUpdatedDateTime(skill.updatedAt, language),
		[language, skill.updatedAt],
	)
	const installCount = formatSkillInstallCount(skill.installCount, language)
	const showInstallCount = skill.publisherType !== "OFFICIAL_BUILTIN"

	const isAdded = skill.status === "added"
	const buttonLabel = isAdded ? t("skillsLibrary.added") : t("skillsLibrary.addToMySkills")

	function handleAction() {
		if (!isAdded) onAdd?.(skill.id)
	}

	function handleOpenDetail() {
		onOpenDetail?.(skill)
	}

	return (
		<div
			role="button"
			tabIndex={0}
			className="flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-popover p-2.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
			onClick={handleOpenDetail}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return
				event.preventDefault()
				handleOpenDetail()
			}}
			data-testid="skills-library-mobile-card"
		>
			<div className="flex min-w-0 items-start gap-2">
				<SkillThumbnail
					src={skill.thumbnail}
					alt={skill.name}
					resetKey={skill.id}
					iconSize={36}
					className="size-9 rounded-lg"
					data-testid="skills-library-mobile-card-thumbnail"
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex min-w-0 items-start justify-between gap-2">
						<p className="min-w-0 flex-1 truncate pt-0.5 text-sm font-medium leading-6 text-foreground">
							{skill.name}
						</p>
						{showFeaturedTag ? (
							<Badge
								variant="outline"
								className="mt-0.5 shrink-0 rounded-md border-transparent bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-300"
								data-testid="skills-library-mobile-card-featured"
							>
								{t("skillsLibrary.featured")}
							</Badge>
						) : null}
					</div>
					<div className="flex min-w-0 items-center justify-between gap-2">
						{packageNameLabel && (
							<Badge
								variant="secondary"
								className="min-w-0 max-w-[55%] shrink rounded-md px-1.5 py-0 text-[10px] font-semibold"
								data-testid="skills-library-mobile-card-code"
							>
								<SmartTooltip
									elementType="span"
									className="block min-w-0 max-w-full truncate"
									content={packageNameLabel}
									sideOffset={4}
								>
									{packageNameLabel}
								</SmartTooltip>
							</Badge>
						)}
						{latestVersionLabel ? (
							<Badge
								variant="outline"
								className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
								data-testid="skills-library-mobile-card-version"
							>
								{latestVersionLabel}
							</Badge>
						) : null}
					</div>
					<p className="line-clamp-2 text-xs leading-4 text-muted-foreground">
						{skill.description}
					</p>
				</div>
			</div>

			<Separator />

			<Button
				variant="default"
				size="sm"
				className="h-8 w-full text-xs shadow-xs"
				onClick={(event) => {
					event.stopPropagation()
					handleAction()
				}}
				disabled={isAdded}
				data-testid="skills-library-mobile-card-action"
			>
				{buttonLabel}
			</Button>

			<div className="flex min-h-8 items-center justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
					{isOfficialPublisher ? (
						<ShieldCheck className="size-4 shrink-0" />
					) : (
						<CircleUserRound className="size-4 shrink-0" />
					)}
					<span className="truncate">{publisherLabel}</span>
				</div>
				{showInstallCount && installCount ? (
					<div
						className="flex min-w-0 flex-col justify-center gap-0.5 leading-tight"
						data-testid="skills-library-mobile-card-install-count"
					>
						<span className="text-[10px] text-muted-foreground/60">
							{t("skillsLibrary.installCountLabel")}
						</span>
						<span className="text-[11px] text-muted-foreground/80">{installCount}</span>
					</div>
				) : null}
				<div className="flex min-w-0 flex-col items-end justify-center gap-0.5 text-right leading-tight">
					<span className="text-[10px] text-muted-foreground/60">
						{t("skillsLibrary.updatedAtLabel")}
					</span>
					<span className="truncate text-[11px] text-muted-foreground/80">
						{updatedAtValue}
					</span>
				</div>
			</div>
		</div>
	)
})
