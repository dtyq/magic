import type { ReactNode } from "react"
import type { UpdateMicroAppBody } from "@/apis/modules/superMagic"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

import MicroAppPublishDialog from "./MicroAppPublishDialog"
import MicroAppEditDialog from "./MicroAppEditDialog"

interface MicroAppPageOverlaysProps {
	appId?: string
	projectName?: string
	mobile?: boolean
	publishDialogOpen: boolean
	onPublishDialogOpenChange: (open: boolean) => void
	attachmentList?: AttachmentItem[]
	onPublishStatusChange: (published: boolean) => void
	onDefaultOpenFileChange?: (fileId: string | null) => void
	onProjectNameChange: (projectName: string) => void
	editDialogOpen: boolean
	editSubmitting: boolean
	onEditDialogOpenChange: (open: boolean) => void
	onEditMicroApp: (changes: UpdateMicroAppBody) => Promise<boolean>
	onCaptureCover?: () => Promise<Blob>
	collaboratorPanel: ReactNode
}

/** 桌面端与移动端共享发布、数据库和协作者浮层，避免两套页面重复维护行为。 */
export default function MicroAppPageOverlays({
	appId,
	projectName,
	mobile = false,
	publishDialogOpen,
	onPublishDialogOpenChange,
	attachmentList,
	onPublishStatusChange,
	onDefaultOpenFileChange,
	onProjectNameChange,
	editDialogOpen,
	editSubmitting,
	onEditDialogOpenChange,
	onEditMicroApp,
	onCaptureCover,
	collaboratorPanel,
}: MicroAppPageOverlaysProps) {
	return (
		<>
			<MicroAppPublishDialog
				open={publishDialogOpen}
				appId={appId}
				projectName={projectName}
				mobile={mobile}
				onProjectNameChange={onProjectNameChange}
				onPublishStatusChange={onPublishStatusChange}
				onDefaultOpenFileChange={onDefaultOpenFileChange}
				onOpenChange={onPublishDialogOpenChange}
				attachmentList={attachmentList}
			/>
			<MicroAppEditDialog
				open={editDialogOpen}
				appId={appId}
				projectName={projectName}
				mobile={mobile}
				isSubmitting={editSubmitting}
				onOpenChange={onEditDialogOpenChange}
				onConfirm={onEditMicroApp}
				onCaptureCover={onCaptureCover}
			/>
			{collaboratorPanel}
		</>
	)
}
