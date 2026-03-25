import { useMemo } from "react"
import dayjs from "dayjs"
import { CircleUserRound, ShieldCheck } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import { normalizeLocale } from "@/utils/locale"

interface StoreSkillCardMobileProps {
	skill: StoreSkillView
	language: string
	onAdd?: (id: string) => void
	onUpgrade?: (id: string) => void
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
}: StoreSkillCardMobileProps) {
	const { t } = useTranslation("crew/market")
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

	return (
		<div
			className="flex flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-popover p-2.5 shadow-sm"
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
				onClick={handleAction}
				disabled={isAdded && !skill.needUpgrade}
				data-testid="skills-library-mobile-card-action"
			>
				{buttonLabel}
			</Button>

			<div className="flex min-h-6 items-center justify-between gap-2">
				<div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
					{skill.authorType === "official" ? (
						<ShieldCheck className="size-4 shrink-0" />
					) : (
						<CircleUserRound className="size-4 shrink-0" />
					)}
					<span className="truncate">
						{skill.authorType === "official"
							? t("skillsLibrary.official")
							: skill.authorName || t("skillsLibrary.authorFallback")}
					</span>
				</div>
				<span className="shrink-0 text-xs text-muted-foreground">{updatedAtLabel}</span>
			</div>
		</div>
	)
})
