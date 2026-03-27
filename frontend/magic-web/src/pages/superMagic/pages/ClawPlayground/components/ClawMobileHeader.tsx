import { ChevronLeft, Files } from "lucide-react"
import { useTranslation } from "react-i18next"
import avatarHighlight from "@/assets/resources/magi-claw/card-avatar-highlight.svg"
import { Button } from "@/components/shadcn-ui/button"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

interface ClawMobileHeaderProps {
	selectedProject: ProjectListItem | null
	onBack: () => void
	onFilesClick: () => void
}

export function ClawMobileHeader({ selectedProject, onBack, onFilesClick }: ClawMobileHeaderProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

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

			<div className="size-7 shrink-0 overflow-hidden rounded-full border border-border bg-background">
				<img
					alt=""
					aria-hidden
					className="pointer-events-none size-full object-cover"
					src={avatarHighlight}
				/>
			</div>

			<p className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
				{selectedProject?.project_name ||
					t("superLobster.workspace.untitledProject", clawBrandValues)}
			</p>

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
