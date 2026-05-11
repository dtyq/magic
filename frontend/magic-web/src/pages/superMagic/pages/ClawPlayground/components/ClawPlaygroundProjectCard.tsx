import type { MouseEvent } from "react"
import type { MagicClawItem } from "@/apis"
import { cn } from "@/lib/utils"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { CircleArrowUp, Loader2, PencilLine } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagiClawTemplateAvatar } from "../../MagiClawPage/MagiClawTemplateAvatar"

interface ClawPlaygroundProjectCardProps {
	magicClaw: MagicClawItem | null
	sandboxLatestVersion?: string | null
	isUpdatingSandbox?: boolean
	onOpenEditDialog: () => void
	onUpgradeSandbox: () => void
}

export function ClawPlaygroundProjectCard({
	magicClaw,
	sandboxLatestVersion,
	isUpdatingSandbox = false,
	onOpenEditDialog,
	onUpgradeSandbox,
}: ClawPlaygroundProjectCardProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const shouldShowUpgradeButton = Boolean(magicClaw?.need_upgrade || isUpdatingSandbox)

	function buildClawDisplayName() {
		return magicClaw?.name || t("superLobster.workspace.untitledProject", clawBrandValues)
	}

	function buildUpgradeTitle() {
		if (sandboxLatestVersion) {
			return t("superLobster.workspace.updateTooltip", {
				...clawBrandValues,
				version: sandboxLatestVersion,
			})
		}

		return t("superLobster.workspace.upgradeAvailable", clawBrandValues)
	}

	function handleEditClick(event: MouseEvent<HTMLButtonElement>) {
		event.stopPropagation()
		onOpenEditDialog()
	}

	function handleUpgradeClick(event: MouseEvent<HTMLButtonElement>) {
		event.stopPropagation()
		onUpgradeSandbox()
	}

	return (
		<div
			className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-background px-2 py-1.5 shadow-xs transition-colors hover:cursor-pointer hover:bg-accent/30"
			data-testid="claw-playground-project-card"
			onClick={onOpenEditDialog}
		>
			<MagiClawTemplateAvatar
				templateCode={magicClaw?.template_code}
				src={magicClaw?.icon_file_url}
				className="size-7 shrink-0 rounded-full border border-border"
			/>

			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<p className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
					{buildClawDisplayName()}
				</p>

				{shouldShowUpgradeButton ? (
					<button
						type="button"
						className={cn(
							"inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-transparent bg-indigo-50 px-2 text-xs font-normal text-indigo-500 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-70",
						)}
						data-testid="claw-playground-project-update-button"
						title={buildUpgradeTitle()}
						disabled={isUpdatingSandbox}
						onClick={handleUpgradeClick}
					>
						{isUpdatingSandbox ? (
							<Loader2 className="size-3 animate-spin" aria-hidden />
						) : (
							<CircleArrowUp className="size-3" aria-hidden />
						)}
						<span>
							{isUpdatingSandbox
								? t("superLobster.workspace.updating", clawBrandValues)
								: t("superLobster.workspace.update", clawBrandValues)}
						</span>
					</button>
				) : null}
			</div>

			<button
				type="button"
				className="ml-auto flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
				data-testid="claw-playground-project-edit-button"
				aria-label={t("superLobster.editDialog.title", clawBrandValues)}
				onClick={handleEditClick}
			>
				<PencilLine className="size-4" />
			</button>
		</div>
	)
}
