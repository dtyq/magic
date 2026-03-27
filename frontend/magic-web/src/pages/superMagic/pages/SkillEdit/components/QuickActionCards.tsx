import { ChevronRight, Settings2, Upload } from "lucide-react"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import type { SkillEditPublishStatus } from "../store/types"

interface QuickActionCardsProps {
	settingsLabel: string
	publishLabel: string
	unpublishedChangesLabel: string
	publishStatus: SkillEditPublishStatus
	activeAction?: "publish" | "settings" | null
	onSettingsClick?: () => void
	onPublishClick?: () => void
}

function QuickActionCards({
	settingsLabel,
	publishLabel,
	unpublishedChangesLabel,
	publishStatus,
	activeAction = null,
	onSettingsClick,
	onPublishClick,
}: QuickActionCardsProps) {
	return (
		<div
			className="overflow-hidden rounded-lg border border-border bg-background"
			data-testid="skill-edit-quick-actions"
		>
			<ActionRow
				icon={<Settings2 className="size-4" />}
				label={settingsLabel}
				testId="skill-edit-settings-button"
				isActive={activeAction === "settings"}
				onClick={onSettingsClick}
			/>
			<Separator />
			<ActionRow
				icon={<Upload className="size-4" />}
				label={publishLabel}
				trailing={
					publishStatus === "draft" ? (
						<Badge
							variant="secondary"
							className="border-transparent bg-amber-50 px-2 py-0.5 text-[12px] font-normal leading-4 text-amber-500"
						>
							{unpublishedChangesLabel}
						</Badge>
					) : null
				}
				testId="skill-edit-publish-button"
				isActive={activeAction === "publish"}
				onClick={onPublishClick}
			/>
		</div>
	)
}

function ActionRow({
	icon,
	label,
	trailing,
	testId,
	isActive = false,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	trailing?: React.ReactNode
	testId: string
	isActive?: boolean
	onClick?: () => void
}) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-12 w-full items-center gap-1.5 overflow-hidden px-2.5 text-left transition-colors",
				onClick ? "hover:bg-accent/50" : "cursor-default",
				isActive && "bg-accent/70",
			)}
			data-testid={testId}
			onClick={onClick}
			aria-pressed={isActive}
		>
			<div className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
				{icon}
			</div>
			<p className="min-w-0 flex-1 truncate text-sm font-medium leading-none text-foreground">
				{label}
			</p>
			{trailing}
			<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
		</button>
	)
}

export default QuickActionCards
