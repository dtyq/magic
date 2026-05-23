import { Copy, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type { ProjectShareSheetController } from "../types"
import { ProjectShareActionFooter } from "./ProjectShareFloatingActionBar"

interface ProjectShareSheetFooterProps {
	controller: ProjectShareSheetController
}

/**
 * Renders view-specific bottom actions outside the scroll area so buttons stay pinned to the sheet bottom.
 */
export function ProjectShareSheetFooter({ controller }: ProjectShareSheetFooterProps) {
	const { t } = useTranslation("super")

	if (controller.view === "create") {
		return (
			<ProjectShareActionFooter testId="project-share-sheet-create-floating-bar">
				<Button
					type="button"
					className="h-12 w-full rounded-xl bg-[#171717] text-[16px] font-medium text-white hover:bg-[#171717] active:opacity-80"
					disabled={controller.saving || controller.isCheckingShare}
					onClick={controller.submitCreateShare}
					data-testid="project-share-sheet-create-submit-button"
				>
					{controller.saving ? t("common.saving") : t("projectShare.createLink")}
				</Button>
			</ProjectShareActionFooter>
		)
	}

	if (controller.view === "linkDetail") {
		return (
			<ProjectShareActionFooter
				className="flex flex-col gap-2"
				testId="project-share-sheet-detail-floating-bar"
			>
				<Button
					type="button"
					className="h-12 w-full rounded-xl bg-[#171717] text-[16px] font-medium text-white hover:bg-[#171717] active:opacity-80"
					onClick={controller.copySelectedShareUrl}
					data-testid="project-share-sheet-copy-link-button"
				>
					<Copy className="mr-2 h-4 w-4" />
					{t("projectShare.copyLink")}
				</Button>
				<Button
					type="button"
					variant="secondary"
					className="h-12 w-full rounded-xl bg-white text-[16px] font-medium text-destructive hover:bg-white active:opacity-80"
					onClick={controller.goToDeleteConfirm}
					data-testid="project-share-sheet-delete-button"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					{t("projectShare.deleteLink")}
				</Button>
			</ProjectShareActionFooter>
		)
	}

	return null
}
