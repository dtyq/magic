import { useState } from "react"
import { Check, ShieldCheck, CircleUserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"

export type SkillStatus = "added" | "not-added"
export type SkillAuthorType = "official" | "user"

export interface SkillCardData {
	id: string
	name: string
	description: string
	thumbnail?: string
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

function SkillCard({ skill, onAdd, onRemove, onUpgrade }: SkillCardProps) {
	const { t } = useTranslation("crew/market")
	const isAdded = skill.status === "added"
	const [isButtonHovered, setIsButtonHovered] = useState(false)

	return (
		<div
			className="flex flex-col gap-3 overflow-hidden rounded-md border border-border bg-popover p-4 shadow-sm"
			data-testid="skill-card"
		>
			{/* Thumbnail + info */}
			<div className="flex min-w-0 items-start gap-2">
				<div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
					{skill.thumbnail && (
						<img
							src={skill.thumbnail}
							alt={skill.name}
							className="size-full object-cover"
						/>
					)}
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<p className="truncate text-base font-medium leading-6 text-foreground">
						{skill.name}
					</p>
					<p className="line-clamp-2 text-sm text-muted-foreground">
						{skill.description}
					</p>
				</div>
			</div>

			<Separator />

			{/* Action button */}
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
					variant={isButtonHovered ? "ghost" : "secondary"}
					className={cn(
						"h-9 w-full",
						isButtonHovered &&
						"bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
					)}
					onMouseEnter={() => setIsButtonHovered(true)}
					onMouseLeave={() => setIsButtonHovered(false)}
					onClick={() => onRemove?.(skill.id)}
					data-testid={
						isButtonHovered ? "skill-card-remove-button" : "skill-card-added-button"
					}
				>
					{isButtonHovered ? (
						t("skillsLibrary.removeFromMySkills")
					) : (
						<Check className="size-4" />
					)}
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

			{/* Footer: author + updated date */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1">
					{skill.authorType === "official" ? (
						<>
							<ShieldCheck className="size-4 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								{t("skillsLibrary.official")}
							</span>
						</>
					) : (
						<>
							<CircleUserRound className="size-4 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								{skill.authorName ?? "Username"}
							</span>
						</>
					)}
				</div>
				<span className="shrink-0 text-xs text-muted-foreground">{skill.updatedAt}</span>
			</div>
		</div>
	)
}

export default observer(SkillCard)
