import { lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import MagicProgressToast from "@/components/base/MagicProgressToast"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
	DuplicateFileModal,
	FolderConflictModal,
} from "@/pages/superMagic/components/TopicFilesButton/components"
import type { AudioRecordingCopyToProjectController } from "../hooks/useAudioRecordingCopyToProject"

const CrossProjectFileOperationModal = lazy(
	() =>
		import("@/pages/superMagic/components/SelectPathModal/components/CrossProjectFileOperationModal"),
)
const SelectDirectoryModal = lazy(
	() => import("@/pages/superMagic/components/SelectPathModal/components/SelectDirectoryModal"),
)

interface AudioRecordingCopyDialogProps {
	controller: AudioRecordingCopyToProjectController
}

/** Renders the recording copy target picker plus the shared conflict and progress surfaces. */
export function AudioRecordingCopyDialog({ controller }: AudioRecordingCopyDialogProps) {
	const { t } = useTranslation(["audioRecordings", "super"])
	const isMobile = useIsMobile()

	return (
		<>
			{controller.visible ? (
				<Suspense fallback={null}>
					{isMobile ? (
						<SelectDirectoryModal
							visible={controller.visible}
							title={t("audioRecordings:copy.dialogTitle")}
							projectId={controller.copyTarget?.id || ""}
							attachments={controller.sourceAttachments}
							mobileCrossProjectConfig={{
								sourceAttachments: controller.sourceAttachments,
								initialViewMode: "workspace",
								workspaces: controller.workspaces,
								includeSpecialWorkspaces: false,
								allowWorkspaceSubmit: true,
							}}
							onClose={controller.closeCopyDialog}
							onSubmit={(data) => {
								void controller.submitCopy({
									targetProjectId: data.targetProjectId || "",
									targetWorkspaceId: data.targetWorkspaceId,
									targetPath: data.path,
									targetAttachments: data.targetAttachments || [],
									sourceAttachments:
										data.sourceAttachments || controller.sourceAttachments,
								})
							}}
						/>
					) : (
						<CrossProjectFileOperationModal
							visible={controller.visible}
							title={t("audioRecordings:copy.dialogTitle")}
							operationType="copy"
							workspaces={controller.workspaces}
							fileIds={controller.sourceFileIds}
							sourceAttachments={controller.sourceAttachments}
							includeFixedWorkspaces={false}
							closeOnSubmit={false}
							allowWorkspaceRootSubmit
							defaultProjectName={controller.defaultProjectName}
							onClose={controller.closeCopyDialog}
							onSubmit={(data) => {
								void controller.submitCopy(data)
							}}
						/>
					)}
				</Suspense>
			) : null}
			{controller.folderConflictModalVisible ? (
				<FolderConflictModal
					visible={controller.folderConflictModalVisible}
					folderName={controller.currentFolderConflictName}
					totalConflicts={controller.totalFolderConflicts}
					canMerge={controller.canMergeFolderConflict}
					onCancel={controller.handleFolderConflictCancel}
					onMerge={controller.handleFolderConflictMerge}
					onKeepBoth={controller.handleFolderConflictKeepBoth}
				/>
			) : null}
			{controller.duplicateModalVisible ? (
				<DuplicateFileModal
					visible={controller.duplicateModalVisible}
					fileName={controller.currentDuplicateFileName}
					totalDuplicates={controller.totalDuplicates}
					onCancel={controller.handleDuplicateCancel}
					onReplace={controller.handleDuplicateReplace}
					onKeepBoth={controller.handleDuplicateKeepBoth}
				/>
			) : null}
			{controller.isOperating && typeof document !== "undefined"
				? createPortal(
						<MagicProgressToast
							visible={controller.isOperating}
							progress={controller.operationProgress}
							text={t("super:topicFiles.copying")}
							position="top"
							showPercentage
							progressHeight={4}
							zIndex={99999}
						/>,
						document.body,
					)
				: null}
		</>
	)
}
