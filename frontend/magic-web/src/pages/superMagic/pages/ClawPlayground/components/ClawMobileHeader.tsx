import { CircleArrowUp, ChevronLeft, Files, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawItem } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { MagiClawTemplateAvatar } from "../../MagiClawPage/MagiClawTemplateAvatar"

interface ClawMobileHeaderProps {
	magicClaw: MagicClawItem | null
	sandboxLatestVersion?: string | null
	isUpdatingSandbox?: boolean
	onBack: () => void
	onUpgradeSandbox: () => void
	onFilesClick: () => void
}

export function ClawMobileHeader({
	magicClaw,
	sandboxLatestVersion,
	isUpdatingSandbox = false,
	onBack,
	onUpgradeSandbox,
	onFilesClick,
}: ClawMobileHeaderProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const shouldShowUpgradeButton = Boolean(magicClaw?.need_upgrade || isUpdatingSandbox)

	function buildUpgradeTitle() {
		if (sandboxLatestVersion) {
			return t("superLobster.workspace.updateTooltip", {
				...clawBrandValues,
				version: sandboxLatestVersion,
			})
		}

		return t("superLobster.workspace.upgradeAvailable", clawBrandValues)
	}

	return (
		<header
			className="z-[25] flex h-12 shrink-0 items-center gap-2 rounded-b-xl bg-background px-2.5 shadow-xs"
			data-testid="claw-mobile-header"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-8 shrink-0"
				data-testid="claw-mobile-back-button"
				onClick={onBack}
			>
				<ChevronLeft className="size-6" />
			</Button>

			<MagiClawTemplateAvatar
				templateCode={magicClaw?.template_code}
				src={magicClaw?.icon_file_url}
				className="size-7 shrink-0 rounded-full border border-border"
			/>

			<p className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
				{magicClaw?.name || t("superLobster.workspace.untitledProject", clawBrandValues)}
			</p>

			{shouldShowUpgradeButton ? (
				<button
					type="button"
					className={cn(
						"inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-transparent bg-indigo-50 px-2 text-xs font-normal text-indigo-500 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-70",
					)}
					data-testid="claw-mobile-update-button"
					title={buildUpgradeTitle()}
					disabled={isUpdatingSandbox}
					onClick={onUpgradeSandbox}
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

			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-8 shrink-0"
				data-testid="claw-mobile-files-button"
				onClick={onFilesClick}
			>
				<Files className="size-4" />
			</Button>
		</header>
	)
}
