import { useCallback, useMemo } from "react"
import type { MenuProps } from "antd"
import { ChevronDown, Download, Pencil, View } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagicDropdown } from "@/components/base"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import CommonHeaderV2 from "../CommonHeaderV2"
import ActionButton from "../CommonHeader/components/ActionButton"
import type { ActionContext, CurrentFileInfo, HeaderActionConfig } from "../CommonHeaderV2/types"
import { canShowShare } from "../CommonHeaderV2/utils/guards"
import type { RecordingDetailFileMap } from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail"
import { resolveSummaryTypeLabel } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/resolve-summary-type-label"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	type RecordingArtifactContent,
	useRecordingArtifactActions,
} from "./useRecordingArtifactActions"

interface RecordingArtifactHeaderProps {
	projectId: string
	recordingName: string
	fileMap: RecordingDetailFileMap | null
	activeContent: RecordingArtifactContent
	activeFile?: AttachmentItem
	currentFile: CurrentFileInfo
	attachments: AttachmentItem[]
	allowEdit: boolean
	allowDownload: boolean
	isReadonlyShare: boolean
	isFullscreen: boolean
	onFullscreen?: () => void
	onRefresh: () => Promise<void> | void
	openFileTab?: (file: AttachmentItem, autoEdit?: boolean) => void
}

/** Presents the standard file-preview actions with recording-specific copy and download behavior. */
export function RecordingArtifactHeader({
	projectId,
	recordingName,
	fileMap,
	activeContent,
	activeFile,
	currentFile,
	attachments,
	allowEdit,
	allowDownload,
	isReadonlyShare,
	isFullscreen,
	onFullscreen,
	onRefresh,
	openFileTab,
}: RecordingArtifactHeaderProps) {
	const { t: tSuper } = useTranslation("super")
	const actions = useRecordingArtifactActions({
		projectId,
		recordingName,
		fileMap,
		activeContent,
	})

	/** Opens the selected source file in the existing editor instead of adding a recording editor. */
	const handleEdit = useCallback(() => {
		if (activeFile) openFileTab?.(activeFile, true)
	}, [activeFile, openFileTab])

	/** Activates and locates the source document represented by the selected recording content tab. */
	const handleLocate = useCallback(() => {
		if (!activeFile?.file_id || !openFileTab) return
		openFileTab(activeFile)
		pubsub.publish(PubSubEvents.Locate_File_In_Tree, activeFile.file_id)
	}, [activeFile, openFileTab])

	/** Applies PPT-style owner permissions before the shared header's normal share guards. */
	const canShowRecordingShare = useCallback(
		(context: ActionContext) => !isReadonlyShare && allowEdit && canShowShare(context),
		[allowEdit, isReadonlyShare],
	)

	const actionConfig = useMemo<HeaderActionConfig>(
		() => ({
			hideDefaults: ["viewMode", "download", "versionMenu", "more"],
			overrides: {
				copy: {
					visible: true,
					disabled: !actions.canCopy,
					order: 40,
					onClick: actions.copyActiveContent,
				},
				refresh: {
					visible: true,
					order: 20,
					onClick: onRefresh,
				},
				share: { visible: canShowRecordingShare, order: 50 },
				fullscreen: { visible: Boolean(onFullscreen), order: 70 },
			},
			customActions: [
				{
					key: "recording-edit",
					zone: "secondary",
					after: "refresh",
					visible: !isReadonlyShare && allowEdit && Boolean(activeFile && openFileTab),
					render: (context) => (
						<ActionButton
							icon={<Pencil size={16} strokeWidth={1.5} />}
							text={tSuper("fileViewer.edit")}
							title={tSuper("fileViewer.edit")}
							showText={context.showButtonText}
							onClick={handleEdit}
							getPopupContainer={context.getPopupContainer}
						/>
					),
				},
				{
					key: "recording-download",
					zone: "secondary",
					after: "share",
					visible: allowDownload,
					render: (context) => (
						<RecordingDownloadAction
							context={context}
							fileMap={fileMap}
							actions={actions}
						/>
					),
				},
				{
					key: "recording-locate",
					zone: "trailing",
					after: "fullscreen",
					visible: !isReadonlyShare && Boolean(activeFile?.file_id && openFileTab),
					render: (context) => (
						<ActionButton
							icon={<View size={16} strokeWidth={1.5} />}
							text={tSuper("fileViewer.locateFile")}
							title={tSuper("fileViewer.locateFile")}
							showText={context.showButtonText}
							onClick={handleLocate}
							getPopupContainer={context.getPopupContainer}
						/>
					),
				},
			],
		}),
		[
			actions,
			activeFile,
			allowDownload,
			allowEdit,
			canShowRecordingShare,
			fileMap,
			handleEdit,
			handleLocate,
			isReadonlyShare,
			onRefresh,
			onFullscreen,
			openFileTab,
			tSuper,
		],
	)

	return (
		<CommonHeaderV2
			type="md"
			showBottomBorder={false}
			detailMode="files"
			currentFile={currentFile}
			attachments={attachments}
			allowEdit={allowEdit}
			showDownload={allowDownload}
			isFullscreen={isFullscreen}
			onFullscreen={onFullscreen}
			actionConfig={actionConfig}
		/>
	)
}

interface RecordingDownloadActionProps {
	context: ActionContext
	fileMap: RecordingDetailFileMap | null
	actions: ReturnType<typeof useRecordingArtifactActions>
}

/** Renders the recording export menu while delegating every download to shared recording utilities. */
function RecordingDownloadAction({ context, fileMap, actions }: RecordingDownloadActionProps) {
	const { t } = useTranslation("audioRecordings")
	const items = useMemo<MenuProps["items"]>(
		() => [
			{
				key: "audio",
				label: t("detail.exportAudio"),
				disabled: !actions.exportAvailability.hasAudio,
			},
			{
				key: "transcript",
				label: t("detail.exportTranscript"),
				disabled: !actions.exportAvailability.hasTranscript,
			},
			{
				key: "notes",
				label: t("detail.exportNotes"),
				disabled: !actions.exportAvailability.hasNotes,
			},
			{
				key: "summaries",
				label: t("detail.exportSummary"),
				disabled: !actions.exportAvailability.hasSummaryFiles,
				children: fileMap?.summaryFiles.map((fileRef) => ({
					key: `summary:${fileRef.type}`,
					label: resolveSummaryTypeLabel(fileRef.type),
					disabled: !fileRef.file?.file_id,
				})),
			},
			{ type: "divider" },
			{
				key: "all",
				label: t("detail.exportAll"),
				disabled: !actions.exportAvailability.hasAnyExportable,
			},
		],
		[actions.exportAvailability, fileMap?.summaryFiles, t],
	)

	/** Routes a menu key to the matching shared recording download action. */
	const handleClick = useCallback<NonNullable<MenuProps["onClick"]>>(
		({ key }) => {
			if (key === "audio") void actions.downloadAudio()
			else if (key === "transcript") void actions.downloadTranscript()
			else if (key === "notes") void actions.downloadNotes()
			else if (key === "all") void actions.downloadAll()
			else if (key.startsWith("summary:")) {
				void actions.downloadSummaryType(key.slice("summary:".length))
			}
		},
		[actions],
	)

	return (
		<MagicDropdown
			menu={{ items, onClick: handleClick }}
			trigger={["click"]}
			placement="bottomRight"
			getPopupContainer={
				context.getPopupContainer
					? () => context.getPopupContainer?.() ?? document.body
					: undefined
			}
		>
			<div data-testid="recording-artifact-download">
				<ActionButton
					icon={<Download size={16} strokeWidth={1.5} />}
					rightIcon={<ChevronDown size={14} strokeWidth={1.5} />}
					text={t("detail.export")}
					title={t("detail.export")}
					showText={context.showButtonText}
					disabled={actions.downloading}
					getPopupContainer={context.getPopupContainer}
				/>
			</div>
		</MagicDropdown>
	)
}
