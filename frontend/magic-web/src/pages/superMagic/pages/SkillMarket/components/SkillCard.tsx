import { useMemo } from "react"
import { ShieldCheck, CircleUserRound } from "lucide-react"
import dayjs from "dayjs"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { normalizeLocale } from "@/utils/locale"

export type SkillStatus = "added" | "not-added"
export type SkillAuthorType = "official" | "user"

export interface SkillCardData {
	id: string
	name: string
	description: string
	thumbnail?: string
	latestVersion?: string
	status: SkillStatus
	authorType: SkillAuthorType
	authorName?: string
	needUpgrade?: boolean
	updatedAt: string
}

interface SkillCardProps {
	skill: SkillCardData
	onAdd?: (id: string) => void
	onRemove?: (id: string) => void
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

function SkillCard({ skill, onAdd, onUpgrade }: SkillCardProps) {
	const { t, i18n } = useTranslation("crew/market")
	const isAdded = skill.status === "added"
	const latestVersionLabel = normalizeDisplayText(skill.latestVersion)
	const updatedAtLabel = useMemo(
		() =>
			t("skillsLibrary.updatedAt", {
				dateTime: formatSkillUpdatedDateTime(skill.updatedAt, i18n.language),
			}),
		[skill.updatedAt, t, i18n.language],
	)

	return (
		<div
			className="flex h-full flex-col gap-3 overflow-hidden rounded-md border border-border bg-popover p-4 shadow-sm"
			data-testid="skill-card"
		>
			<div className="flex min-w-0 flex-1 items-start gap-2">
				<SkillThumbnail
					src={skill.thumbnail}
					alt={skill.name}
					iconSize={56}
					className="size-14 rounded-xl"
					resetKey={skill.id}
					data-testid="skill-card-thumbnail"
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex flex-col gap-2">
						<p className="truncate text-base font-medium leading-6 text-foreground">
							{skill.name}
						</p>
						{latestVersionLabel ? (
							<Badge
								variant="outline"
								className="w-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
								data-testid="skill-card-version-badge"
							>
								{latestVersionLabel}
							</Badge>
						) : null}
					</div>
					<p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
						{skill.description}
					</p>
				</div>
			</div>

			<Separator />

			{isAdded && skill.needUpgrade ? (
				<Button
					variant="default"
					className="h-9 w-full"
					onClick={() => onUpgrade?.(skill.id)}
					data-testid="skill-card-upgrade-button"
				>
					{t("skillsLibrary.upgrade")}
				</Button>
			) : isAdded ? (
				<Button
					variant="default"
					className="h-9 w-full"
					disabled
					data-testid="skill-card-added-button"
				>
					{t("skillsLibrary.added")}
				</Button>
			) : (
				<Button
					variant="default"
					className="h-9 w-full"
					onClick={() => onAdd?.(skill.id)}
					data-testid="skill-card-add-button"
				>
					{t("skillsLibrary.addToMySkills")}
				</Button>
			)}

			<div className="mt-auto flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1">
					{skill.authorType === "official" ? (
						<>
							<ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate text-xs text-muted-foreground">
								{t("skillsLibrary.official")}
							</span>
						</>
					) : (
						<>
							<CircleUserRound className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate text-xs text-muted-foreground">
								{skill.authorName ?? "Username"}
							</span>
						</>
					)}
				</div>
				<span className="shrink-0 text-right text-xs text-muted-foreground">
					{updatedAtLabel}
				</span>
			</div>
		</div>
	)
}

export default observer(SkillCard)
