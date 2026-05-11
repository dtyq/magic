import type { ReactNode } from "react"
import { ChevronRight, Loader2, Settings2, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import type { SkillEditPublishStatus } from "../store/types"

interface QuickActionCardsProps {
	settingsLabel: string
	publishLabel: string
	unpublishedChangesLabel: string
	publishStatus: SkillEditPublishStatus
	isPublishPrepareLoading?: boolean
	canPublish?: boolean
	activeAction?: "publish" | "settings" | null
	onSettingsClick?: () => void
	onPublishClick?: () => void
	extraContent?: ReactNode
}

function QuickActionCards({
	settingsLabel,
	publishLabel,
	unpublishedChangesLabel,
	publishStatus,
	isPublishPrepareLoading = false,
	canPublish = true,
	activeAction = null,
	onSettingsClick,
	onPublishClick,
	extraContent,
}: QuickActionCardsProps) {
	const { t } = useTranslation("crew/market")

	return (
		<div
			className="overflow-hidden rounded-lg border border-border bg-background"
			data-testid="skill-edit-quick-actions"
		>
			{extraContent ? (
				<>
					{extraContent}
					<Separator />
				</>
			) : null}
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
					!canPublish ? (
						<span
							className="text-xs text-muted-foreground"
							data-testid="skill-edit-publish-no-permission"
						>
							{t("skillEditPage.actions.noPublishPermission")}
						</span>
					) : isPublishPrepareLoading || publishStatus === "draft" ? (
						<span className="flex shrink-0 items-center gap-1.5">
							{isPublishPrepareLoading ? (
								<Loader2
									className="size-4 shrink-0 animate-spin text-muted-foreground"
									aria-hidden
									data-testid="skill-edit-publish-preparing-loader"
								/>
							) : null}
							{publishStatus === "draft" ? (
								<Badge
									variant="secondary"
									className="border-transparent bg-amber-50 px-2 py-0.5 text-[12px] font-normal leading-4 text-amber-500"
								>
									{unpublishedChangesLabel}
								</Badge>
							) : null}
						</span>
					) : null
				}
				testId="skill-edit-publish-button"
				isActive={activeAction === "publish"}
				ariaBusy={isPublishPrepareLoading}
				disabled={!canPublish}
				hideChevron={!canPublish}
				onClick={onPublishClick}
			/>
		</div>
	)
}

export interface QuickActionCardRowProps {
	icon: ReactNode
	label: string
	trailing?: ReactNode
	testId: string
	isActive?: boolean
	ariaBusy?: boolean
	disabled?: boolean
	hideChevron?: boolean
	onClick?: () => void
}

export function QuickActionCardRow({
	icon,
	label,
	trailing,
	testId,
	isActive = false,
	ariaBusy = false,
	disabled = false,
	hideChevron = false,
	onClick,
}: QuickActionCardRowProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-12 w-full items-center gap-1.5 overflow-hidden px-2.5 text-left transition-colors",
				onClick ? "hover:bg-accent/50" : "cursor-default",
				isActive && "bg-accent/70",
				disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
			)}
			data-testid={testId}
			disabled={disabled}
			onClick={onClick}
			aria-busy={ariaBusy}
			aria-pressed={isActive}
		>
			<div className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
				{icon}
			</div>
			<p className="min-w-0 flex-1 truncate text-sm font-medium leading-none text-foreground">
				{label}
			</p>
			{trailing}
			{hideChevron ? null : (
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			)}
		</button>
	)
}

function ActionRow({
	icon,
	label,
	trailing,
	testId,
	isActive = false,
	ariaBusy = false,
	onClick,
}: QuickActionCardRowProps) {
	return (
		<QuickActionCardRow
			icon={icon}
			label={label}
			trailing={trailing}
			testId={testId}
			isActive={isActive}
			ariaBusy={ariaBusy}
			onClick={onClick}
		/>
	)
}

export default QuickActionCards
