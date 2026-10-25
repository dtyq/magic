import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import MicroAppEntryPreview from "./MicroAppEntryPreview"
import MicroAppPreviewPages from "./MicroAppPreviewPages"
import MicroAppPreviewTabs from "./MicroAppPreviewTabs"
import MicroAppOpenPageMenu from "./MicroAppOpenPageMenu"
import { useMicroAppPreviewFiles } from "../hooks/useMicroAppPreviewFiles"

interface MicroAppMobileEntryPreviewProps {
	microAppId?: string
	microAppName?: string
	entryFile: AttachmentItem | null
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	projectId?: string
	selectedProject: ProjectListItem | null
	allowEdit: boolean
	isBuilding?: boolean
	showOpenPageMenu?: boolean
}

function MicroAppMobileEntryPreview({
	microAppId,
	microAppName,
	entryFile,
	attachments,
	attachmentList,
	projectId,
	selectedProject,
	allowEdit,
	isBuilding = false,
	showOpenPageMenu = false,
}: MicroAppMobileEntryPreviewProps) {
	// Use the desktop browsing contexts instead of routing iframe navigation to a file modal.
	const browser = useMicroAppPreviewFiles({
		attachmentList,
		defaultEntryFile: entryFile,
		scopeKey: microAppId ?? projectId ?? "",
	})
	const commonProps = {
		microAppId,
		microAppName,
		attachments,
		attachmentList,
		projectId,
		selectedProject,
		allowEdit,
		isBuilding,
		storageMarkerId: entryFile?.file_id,
		viewMode: "desktop" as const,
		emptyTestId: "micro-app-mobile-preview-empty",
		buildingTestId: "micro-app-mobile-preview-building",
	}
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
			{(browser.previewTabs.length > 0 || showOpenPageMenu) && (
				<div className="flex shrink-0 items-center border-b border-border">
					<MicroAppPreviewTabs {...browser} />
					{showOpenPageMenu && <MicroAppOpenPageMenu browser={browser} />}
				</div>
			)}
			<div className="min-h-0 flex-1">
				<MicroAppPreviewPages browser={browser}>
					{({ tab, onOpenFile }) => (
						<MicroAppEntryPreview
							{...commonProps}
							entryFile={tab.file}
							refreshKey={tab.revision}
							onOpenFile={onOpenFile}
						/>
					)}
				</MicroAppPreviewPages>
				{!browser.previewTabs.length && (
					<MicroAppEntryPreview {...commonProps} entryFile={null} />
				)}
			</div>
		</div>
	)
}

export default MicroAppMobileEntryPreview
