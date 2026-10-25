import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { HtmlPermissionManagerHandle } from "@/pages/superMagic/components/Detail/contents/HTML/hooks/useHtmlPermissionManagerBridge"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

import PublishedMicroAppConversationProvider from "@/pages/share/microApp/components/PublishedMicroAppConversationProvider"
import MicroAppEntryPreview from "./MicroAppEntryPreview"
import MicroAppPreviewPages from "./MicroAppPreviewPages"
import MicroAppPreviewTabs from "./MicroAppPreviewTabs"
import { useMicroAppPreviewFiles } from "../hooks/useMicroAppPreviewFiles"

interface MicroAppPreviewWorkspaceProps {
	appId: string
	entryFile: AttachmentItem | null
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	projectId: string
	selectedProject: ProjectListItem | null
	sourceOrganizationCode?: string
	storageMarkerId?: string
	onHtmlPermissionManagerChange?: (manager: HtmlPermissionManagerHandle | null) => void
}

/**
 * Preview mode keeps the development files as the preview source, but uses the
 * published conversation host and runtime-project lifecycle.
 */
export default function MicroAppPreviewWorkspace({
	appId,
	entryFile,
	attachments,
	attachmentList,
	projectId,
	selectedProject,
	sourceOrganizationCode,
	storageMarkerId,
	onHtmlPermissionManagerChange,
}: MicroAppPreviewWorkspaceProps) {
	const browser = useMicroAppPreviewFiles({
		attachmentList,
		defaultEntryFile: entryFile,
		scopeKey: appId,
	})
	return (
		<PublishedMicroAppConversationProvider
			appId={appId}
			appName={selectedProject?.project_name}
			sourceOrganizationCode={sourceOrganizationCode}
		>
			<div
				className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
				data-testid="micro-app-runtime-preview-workspace"
			>
				<div className="flex shrink-0 border-b border-border bg-muted/10">
					<MicroAppPreviewTabs {...browser} />
				</div>
				<div className="min-h-0 flex-1">
					<MicroAppPreviewPages browser={browser}>
						{({ tab, active, onOpenFile }) => (
							<MicroAppEntryPreview
								entryFile={tab.file}
								refreshKey={tab.revision}
								attachments={attachments}
								attachmentList={attachmentList}
								projectId={projectId}
								selectedProject={selectedProject}
								allowEdit={false}
								onOpenFile={onOpenFile}
								onHtmlPermissionManagerChange={
									active ? onHtmlPermissionManagerChange : undefined
								}
								storageMarkerId={storageMarkerId}
								microAppId={appId}
								microAppName={selectedProject?.project_name}
								isBuilding={false}
								emptyTestId="micro-app-runtime-preview-empty"
							/>
						)}
					</MicroAppPreviewPages>
					{!browser.previewTabs.length && (
						<MicroAppEntryPreview
							entryFile={null}
							attachments={attachments}
							attachmentList={attachmentList}
							selectedProject={selectedProject}
							allowEdit={false}
							emptyTestId="micro-app-runtime-preview-empty"
						/>
					)}
				</div>
			</div>
		</PublishedMicroAppConversationProvider>
	)
}
