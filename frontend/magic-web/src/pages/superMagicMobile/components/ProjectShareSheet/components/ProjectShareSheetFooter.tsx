import { Share2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { isOrganizationDesignatedShareIncomplete } from "@/pages/superMagic/components/Share/utils/organizationShareGuards"
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

	if (controller.view === "create" || controller.view === "edit") {
		return (
			<ProjectShareActionFooter
				testId={
					controller.view === "edit"
						? "project-share-sheet-edit-floating-bar"
						: "project-share-sheet-create-floating-bar"
				}
			>
				<Button
					type="button"
					className="h-12 w-full rounded-xl bg-[#171717] text-[16px] font-medium text-white hover:bg-[#171717] active:opacity-80"
					disabled={
						controller.saving ||
						controller.isCheckingShare ||
						controller.shareTypePermissionLoading ||
						controller.isSelectedShareTypePermitted === false ||
						(controller.view === "edit" && controller.editLoading) ||
						isOrganizationDesignatedShareIncomplete(
							controller.formState.shareType,
							controller.formState.shareRange,
							controller.formState.shareTargets.length,
						)
					}
					onClick={controller.submitCreateShare}
					data-testid={
						controller.view === "edit"
							? "project-share-sheet-edit-submit-button"
							: "project-share-sheet-create-submit-button"
					}
				>
					{controller.saving
						? t("common.saving")
						: controller.view === "edit"
							? t("common.save")
							: t("projectShare.createLink")}
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
				{controller.canNativeShare ? (
					<Button
						type="button"
						variant="secondary"
						className="h-12 w-full rounded-xl bg-white text-[16px] font-medium text-[#171717] hover:bg-white active:opacity-80"
						// Keep the native share action disabled until the prebuilt payload is ready, avoiding a no-op click.
						disabled={!controller.selectedShareMessageText}
						onClick={() => void controller.shareSelectedShareToSystem()}
						data-testid="project-share-sheet-native-share-button"
					>
						<Share2 className="mr-2 h-4 w-4" />
						{t("share.shareToSystem")}
					</Button>
				) : null}
				<Button
					type="button"
					className="h-12 w-full rounded-xl bg-[#171717] text-[16px] font-medium text-white hover:bg-[#171717] active:opacity-80"
					// Wait for the prefetched payload so copying never starts with an iOS-incompatible network request.
					disabled={!controller.selectedShareMessageText}
					onClick={controller.copySelectedShareUrl}
					data-testid="project-share-sheet-copy-link-button"
				>
					{t("projectShare.copyLink")}
				</Button>
				<Button
					type="button"
					variant="secondary"
					className="h-12 w-full rounded-xl bg-white text-[16px] font-medium text-[#171717] hover:bg-white active:opacity-80"
					onClick={controller.openEditSelectedShare}
					data-testid="project-share-sheet-edit-button"
				>
					{t("share.editShare")}
				</Button>
				<Button
					type="button"
					variant="secondary"
					className="h-12 w-full rounded-xl bg-white text-[16px] font-medium text-destructive hover:bg-white active:opacity-80"
					onClick={controller.goToDeleteConfirm}
					data-testid="project-share-sheet-delete-button"
				>
					{t("share.cancelShare")}
				</Button>
			</ProjectShareActionFooter>
		)
	}

	return null
}
