import { useMemo } from "react"
import dayjs from "dayjs"
import { Award, CircleUserRound, ShieldCheck } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import { normalizeLocale } from "@/utils/locale"
import { isOfficialStoreSkillPublisher, resolveStoreSkillPublisherLabel } from "./skill-publisher"

interface StoreSkillCardMobileProps {
	skill: StoreSkillView
	language: string
	onAdd?: (id: string) => void
	onUpgrade?: (id: string) => void
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
	onAdd,
	onUpgrade,
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
	const updatedAtLabel = useMemo(
		() =>
			t("skillsLibrary.updatedAt", {
				dateTime: formatSkillUpdatedDateTime(skill.updatedAt, language),
			}),
		[language, skill.updatedAt, t],
	)

	const isAdded = skill.status === "added"
	const buttonLabel = isAdded
		? skill.needUpgrade
			? t("skillsLibrary.upgrade")
			: t("skillsLibrary.added")
		: t("skillsLibrary.addToMySkills")

	function handleAction() {
		if (isAdded && skill.needUpgrade) {
			onUpgrade?.(skill.id)
			return
		}

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
						{skill.isFeatured ? (
							<Badge
								variant="outline"
								className="size-6 shrink-0 rounded-md border-transparent bg-orange-50/90 p-1 text-orange-500 hover:bg-orange-50/90 dark:bg-orange-950/30 dark:text-orange-300"
								aria-label={t("skillsLibrary.featured")}
								title={t("skillsLibrary.featured")}
								data-testid="skills-library-mobile-card-featured"
							>
								<Award className="size-4" />
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
				disabled={isAdded && !skill.needUpgrade}
				data-testid="skills-library-mobile-card-action"
			>
				{buttonLabel}
			</Button>

			<div className="flex min-h-6 items-center justify-between gap-2">
				<div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
					{isOfficialPublisher ? (
						<ShieldCheck className="size-4 shrink-0" />
					) : (
						<CircleUserRound className="size-4 shrink-0" />
					)}
					<span className="truncate">{publisherLabel}</span>
				</div>
				<span className="shrink-0 text-xs text-muted-foreground">{updatedAtLabel}</span>
			</div>
		</div>
	)
})
