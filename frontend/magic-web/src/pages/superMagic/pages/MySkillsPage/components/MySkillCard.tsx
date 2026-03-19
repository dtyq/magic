import { memo, useMemo } from "react"
import { Ellipsis, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import MagicDropdown from "@/components/base/MagicDropdown"
import type { SkillSourceType } from "@/apis/modules/skills"
import SkillDefaultIcon from "./SkillDefaultIcon"

export interface MySkillCardData {
	id: string
	name: string
	description: string
	thumbnail?: string
	needUpgrade?: boolean
	updatedAt: string
	sourceType: SkillSourceType
}

interface MySkillCardProps {
	skill: MySkillCardData
	onEdit?: (id: string) => void
	onUpdate?: (id: string) => void
	onDelete?: (id: string) => void
}

function MySkillCard({ skill, onEdit, onUpdate, onDelete }: MySkillCardProps) {
	const { t } = useTranslation("crew/market")

	const isUserUploaded = skill.sourceType === "LOCAL_UPLOAD"

	const menuItems = useMemo(
		() => [
			...(isUserUploaded
				? [
					{
						key: "edit",
						icon: <Pencil className="size-4" />,
						label: t("mySkills.edit"),
						onClick: () => onEdit?.(skill.id),
						"data-testid": "my-skill-card-edit",
					},
					{
						key: "update",
						icon: <RefreshCw className="size-4" />,
						label: t("mySkills.update"),
						onClick: () => onUpdate?.(skill.id),
						"data-testid": "my-skill-card-update",
					},
				]
				: []),
			{
				key: "delete",
				icon: <Trash2 className="size-4 text-destructive" />,
				label: <span className="text-destructive">{t("mySkills.delete")}</span>,
				onClick: () => onDelete?.(skill.id),
				"data-testid": "my-skill-card-delete",
			},
		],
		[t, onEdit, onUpdate, skill.id, onDelete, isUserUploaded],
	)

	return (
		<div
			className="flex h-full flex-col gap-3 overflow-hidden rounded-md border border-border bg-popover p-4 shadow-sm"
			data-testid="my-skill-card"
		>
			{/* Thumbnail + info */}
			<div className="flex min-w-0 flex-1 items-start gap-2">
				<div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
					{skill.thumbnail ? (
						<img
							src={skill.thumbnail}
							alt={skill.name}
							className="size-full object-cover"
						/>
					) : (
						<SkillDefaultIcon size={48} />
					)}
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex items-center gap-2">
						<p className="truncate text-base font-medium leading-6 text-foreground">
							{skill.name}
						</p>
						{skill.needUpgrade ? (
							<Badge variant="secondary" data-testid="my-skill-card-upgrade-badge">
								{t("skillsLibrary.upgrade")}
							</Badge>
						) : null}
					</div>
					<p className="line-clamp-2 text-sm text-muted-foreground">
						{skill.description}
					</p>
				</div>
			</div>

			<Separator />

			{/* Footer: updated time + more options */}
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground">
					{t("mySkills.updatedAt", { date: skill.updatedAt })}
				</span>
				<MagicDropdown menu={{ items: menuItems }} placement="bottomRight">
					<span>
						<Button
							variant="ghost"
							size="icon"
							className="size-6 shrink-0"
							data-testid="my-skill-card-more-button"
						>
							<Ellipsis className="size-4" />
						</Button>
					</span>
				</MagicDropdown>
			</div>
		</div>
	)
}

export default memo(MySkillCard)
