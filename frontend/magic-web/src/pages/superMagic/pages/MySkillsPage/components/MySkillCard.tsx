import { memo, useMemo } from "react"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import MagicDropdown from "@/components/base/MagicDropdown"
import type { SkillSourceType } from "@/apis/modules/skills"
import { cn } from "@/lib/utils"
import { UserSkillView } from "@/services/skills/SkillsService"
import {
	getMySkillCardCopy,
	MySkillCardBadges,
	MySkillCardFooterLabel,
	MySkillCardInfoSection,
	resolveTeamSharedSkillPermissions,
	type MySkillCardVariant,
} from "./MySkillCardShared"

export interface MySkillCardData {
	id: string
	name: string
	skillCode: string
	description: string
	thumbnail?: string
	needUpgrade?: boolean
	latestVersion?: string
	latestPublishedAt?: string | null
	updatedAt: string
	sourceType: SkillSourceType
}

interface MySkillCardProps {
	skill: UserSkillView
	cardVariant: MySkillCardVariant
	onOpenDetail?: (skill: UserSkillView) => void
	onEdit?: (code: string) => void
	onDelete?: (id: string) => void
	onRemove?: (id: string) => void
	canEdit?: boolean
	isInteractive?: boolean
}

interface MenuActionInfo {
	domEvent?: {
		preventDefault?: () => void
		stopPropagation?: () => void
	}
}

function stopCardNavigation(domEvent?: MenuActionInfo["domEvent"]) {
	domEvent?.preventDefault?.()
	domEvent?.stopPropagation?.()
}

function isEventFromDetachedTarget(event: React.MouseEvent<HTMLElement>) {
	const target = event.target
	if (!(target instanceof Node)) return false
	return !event.currentTarget.contains(target)
}

function MySkillCard({
	skill,
	cardVariant,
	onOpenDetail,
	onEdit,
	onDelete,
	onRemove,
	canEdit = false,
	isInteractive = true,
}: MySkillCardProps) {
	const { t } = useTranslation("crew/market")
	const { displayDescription, displayName, footerLabel, latestVersion, packageName } =
		getMySkillCardCopy({
			skill,
			cardVariant,
			t,
		})
	const isTeamSharedCard = cardVariant === "team"
	const teamPermissions = resolveTeamSharedSkillPermissions(skill.userRole)
	const canShowTeamSharedMenu =
		isTeamSharedCard && (teamPermissions.canEdit || teamPermissions.canDelete)
	const resolvedOnDelete = isTeamSharedCard
		? teamPermissions.canDelete
			? onDelete
			: undefined
		: onDelete
	const resolvedOnRemove = isTeamSharedCard ? undefined : onRemove
	const canManage = isTeamSharedCard
		? canShowTeamSharedMenu
		: Boolean(onDelete || onRemove || canEdit)

	const menuItems = useMemo(() => {
		if (!canManage) return []

		const items = []

		if (canEdit) {
			items.push({
				key: "edit",
				icon: <Pencil className="size-4" />,
				label: t("mySkills.edit"),
				onClick: ({ domEvent }: MenuActionInfo) => {
					stopCardNavigation(domEvent)
					onEdit?.(skill.skillCode)
				},
				"data-testid": "my-skill-card-edit",
			})
		}

		if (resolvedOnDelete) {
			items.push({
				key: "delete",
				icon: <Trash2 className="size-4 text-destructive" />,
				label: <span className="text-destructive">{t("mySkills.delete")}</span>,
				onClick: ({ domEvent }: MenuActionInfo) => {
					stopCardNavigation(domEvent)
					resolvedOnDelete(skill.id)
				},
				"data-testid": "my-skill-card-delete",
			})
		}

		if (resolvedOnRemove) {
			items.push({
				key: "remove",
				icon: <Trash2 className="size-4 text-destructive" />,
				label: <span className="text-destructive">{t("mySkills.remove")}</span>,
				onClick: ({ domEvent }: MenuActionInfo) => {
					stopCardNavigation(domEvent)
					resolvedOnRemove(skill.id)
				},
				"data-testid": "my-skill-card-remove",
			})
		}

		return items
	}, [
		canManage,
		canEdit,
		t,
		onEdit,
		skill.skillCode,
		skill.id,
		resolvedOnDelete,
		resolvedOnRemove,
	])

	function preventCardNavigation(event: React.MouseEvent<HTMLElement>) {
		event.preventDefault()
		event.stopPropagation()
	}

	function handleCardClick(event: React.MouseEvent<HTMLElement>) {
		if (!isInteractive) return

		if (event.defaultPrevented) return
		if (isEventFromDetachedTarget(event)) return
		onOpenDetail?.(skill)
	}

	function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
		if (!isInteractive) return

		if (event.key !== "Enter" && event.key !== " ") return

		event.preventDefault()
		onOpenDetail?.(skill)
	}

	return (
		<div
			role={isInteractive ? "button" : undefined}
			tabIndex={isInteractive ? 0 : undefined}
			onClick={isInteractive ? handleCardClick : undefined}
			onKeyDown={isInteractive ? handleCardKeyDown : undefined}
			className={cn(
				"flex h-full flex-col gap-3 overflow-hidden rounded-md border border-border bg-popover p-4 text-current no-underline shadow-sm",
				isInteractive && "transition-colors hover:border-primary/40 hover:bg-accent/40",
			)}
			data-testid="my-skill-card"
		>
			{/* Thumbnail + info */}
			<MySkillCardInfoSection
				skill={skill}
				displayName={displayName}
				displayDescription={displayDescription}
				iconSize={56}
				thumbnailClassName="size-14 rounded-xl"
				rootClassName="flex min-w-0 flex-1 items-start gap-2"
				contentClassName="flex min-w-0 flex-1 flex-col gap-2"
				titleRowClassName="min-w-0"
				titleClassName="text-base font-medium leading-6 text-foreground"
				descriptionClassName="text-sm leading-5 text-muted-foreground"
				testIdPrefix="my-skill-card"
				belowTitle={
					<div className="flex min-w-0 items-center gap-2 overflow-hidden">
						<MySkillCardBadges
							skill={skill}
							cardVariant={cardVariant}
							packageName={packageName}
							latestVersion={latestVersion}
							t={t}
							testIdPrefix="my-skill-card"
						/>
					</div>
				}
			/>

			<Separator />

			{/* Footer varies by skill ownership/source */}
			<div
				className="flex items-center justify-between gap-2"
				data-testid="my-skill-card-footer"
			>
				<MySkillCardFooterLabel
					footerLabel={footerLabel}
					className="min-w-0 flex-1 text-xs text-muted-foreground"
					testId="my-skill-card-footer-label"
				/>
				{skill.publisherType !== "OFFICIAL_BUILTIN" && menuItems.length > 0 ? (
					<MagicDropdown menu={{ items: menuItems }} placement="bottomRight" model={true}>
						<span onClick={preventCardNavigation}>
							<Button
								asChild
								variant="ghost"
								size="icon"
								className="size-6 shrink-0 rounded-md hover:bg-accent"
								aria-label={t("mySkills.moreActionsAria")}
							>
								<span data-testid="my-skill-card-more-button">
									<Ellipsis className="size-4" />
								</span>
							</Button>
						</span>
					</MagicDropdown>
				) : null}
			</div>
		</div>
	)
}

export default memo(MySkillCard)
