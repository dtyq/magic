import MagicModal from "@/components/base/MagicModal"
import i18next from "i18next"
import {
	getProjectDeletionBlock,
	ProjectDeletionBlockedByRecordingError,
	type ProjectDeletionBlock,
} from "./projectDeletionRecordingGuard"

function showBlock(block: ProjectDeletionBlock) {
	MagicModal.info({
		title: i18next.t("recordingSummary.projectDeletion.title", { ns: "super" }),
		content:
			block.reason === "unresolved-other-tab"
				? i18next.t("recordingSummary.projectDeletion.otherTab", { ns: "super" })
				: i18next.t("recordingSummary.projectDeletion.active", { ns: "super" }),
		okText: i18next.t("recordingSummary.projectDeletion.confirm", { ns: "super" }),
	})
}

export function canDeleteRecordingProjects(projectIds: string[]): boolean {
	const block = getProjectDeletionBlock(projectIds)
	if (!block) return true
	showBlock(block)
	return false
}

/** A late recording start is a blocked operation, not a failed server delete. */
export function handleRecordingProjectDeletionError(error: unknown): boolean {
	if (!(error instanceof ProjectDeletionBlockedByRecordingError)) return false
	showBlock(error.block)
	return true
}
