import { useMemo } from "react"
import { Award, CircleUserRound, ShieldCheck } from "lucide-react"
import dayjs from "dayjs"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import type { SkillPublisherType } from "@/apis/modules/skills"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { normalizeLocale } from "@/utils/locale"
import { isOfficialStoreSkillPublisher, resolveStoreSkillPublisherLabel } from "./skill-publisher"

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
	updatedAt: string
}

interface SkillCardProps {
	skill: SkillCardData
	onAdd?: (id: string) => void
	onUpgrade?: (id: string) => void
	onOpenDetail?: (skill: SkillCardData) => void
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

function SkillCard({ skill, onAdd, onOpenDetail }: SkillCardProps) {
	const { t, i18n } = useTranslation("crew/market")
	const isAdded = skill.status === "added"
	const publisherLabel = resolveStoreSkillPublisherLabel({
		authorName: skill.authorName,
		publisherType: skill.publisherType,
		t,
		fallbackLabel: "Username",
	})
	const isOfficialPublisher = isOfficialStoreSkillPublisher(skill.publisherType)
	const packageNameLabel = normalizeDisplayText(skill.packageName) ?? skill.skillCode
	// const latestVersionLabel = normalizeDisplayText(skill.latestVersion)
	const updatedAtLabel = useMemo(
		() =>
			t("skillsLibrary.updatedAt", {
				dateTime: formatSkillUpdatedDateTime(skill.updatedAt, i18n.language),
			}),
		[skill.updatedAt, t, i18n.language],
	)

	function handleOpenDetail() {
		onOpenDetail?.(skill)
	}

	function handleActionClick(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation()
	}

	return (
		<div
			role="button"
			tabIndex={0}
			className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-md"
			onClick={handleOpenDetail}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return
				event.preventDefault()
				handleOpenDetail()
			}}
			data-testid="skill-card"
		>
			<div className="relative flex h-full flex-col gap-4 p-5">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<SkillThumbnail
						src={skill.thumbnail}
						alt={skill.name}
						iconSize={56}
						className="relative size-14 shrink-0 rounded-xl border border-border bg-background shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
						resetKey={skill.id}
						data-testid="skill-card-thumbnail"
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
						<div className="flex items-start justify-between gap-2">
							<p className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground transition-colors duration-300">
								{skill.name}
							</p>
							{skill.isFeatured ? (
								<Badge
									variant="outline"
									className="size-6 shrink-0 rounded-md border-transparent bg-orange-500/10 p-1 text-orange-600 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
									aria-label={t("skillsLibrary.featured")}
									title={t("skillsLibrary.featured")}
									data-testid="skill-card-featured-badge"
								>
									<Award className="size-4" />
								</Badge>
							) : null}
						</div>
						<div className="flex min-w-0 items-center justify-between gap-2">
							<Badge
								variant="secondary"
								className="min-w-0 max-w-[60%] shrink rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
								data-testid="skill-card-code-badge"
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
							{/* {latestVersionLabel ? (
								<span
									className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground"
									data-testid="skill-card-version-badge"
								>
									v{latestVersionLabel}
								</span>
							) : null} */}
						</div>
					</div>
				</div>

				<SmartTooltip
					elementType="div"
					maxLines={2}
					className="min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground/90"
					content={skill.description}
					sideOffset={4}
				>
					{skill.description}
				</SmartTooltip>

				<div className="mt-auto flex flex-col gap-4 pt-1">
					{
						// isAdded && skill.needUpgrade ? (
						// 	<Button
						// 		variant="default"
						// 		className="h-9 w-full rounded-md shadow-sm transition-all duration-300 hover:shadow-md"
						// 		onClick={(event) => {
						// 			handleActionClick(event)
						// 			onUpgrade?.(skill.id)
						// 		}}
						// 		data-testid="skill-card-upgrade-button"
						// 	>
						// 		{t("skillsLibrary.upgrade")}
						// 	</Button>
						// ) :
						isAdded ? (
							<Button
								variant="secondary"
								className="h-9 w-full rounded-md border border-border bg-secondary/50 text-secondary-foreground shadow-none"
								disabled
								data-testid="skill-card-added-button"
							>
								{t("skillsLibrary.added")}
							</Button>
						) : (
							<Button
								variant="outline"
								className="h-9 w-full rounded-md border-border bg-background text-foreground shadow-sm transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md active:scale-[0.98]"
								onClick={(event) => {
									handleActionClick(event)
									onAdd?.(skill.id)
								}}
								data-testid="skill-card-add-button"
							>
								{t("skillsLibrary.addToMySkills")}
							</Button>
						)
					}

					<div className="flex items-center justify-between gap-2">
						<div
							className="flex min-w-0 items-center gap-1.5"
							data-testid="skill-card-publisher"
						>
							{isOfficialPublisher ? (
								<>
									<ShieldCheck className="size-3.5 shrink-0 text-primary" />
									<span className="truncate text-xs font-medium text-muted-foreground">
										{publisherLabel}
									</span>
								</>
							) : (
								<>
									<CircleUserRound className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="truncate text-xs font-medium text-muted-foreground">
										{publisherLabel}
									</span>
								</>
							)}
						</div>
						<span className="shrink-0 text-right text-[11px] font-medium text-muted-foreground">
							{updatedAtLabel}
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}

export default observer(SkillCard)
