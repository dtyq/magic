import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import type { ProjectListItem, TaskStatus, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { RefObject } from "react"
import { ClawSkillsPanel } from "./ClawSkillsPanel"

export interface ClawPlaygroundDetailPanelProps {
	isSkillsPanelOpen: boolean
	onCloseSkillsPanel: () => void
	detailRef: RefObject<DetailRef | null>
	userSelectDetail: unknown
	setUserSelectDetail: (detail: unknown) => void
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	selectedTopic: Topic | null
	selectedProject: ProjectListItem
	activeFileId: string | null
	setActiveFileId: (fileId: string | null) => void
	handleActiveDetailTabChange: (tabType: "playback" | "file" | null) => void
	setIsDetailPanelFullscreen: (isFullscreen: boolean) => void
	isReadOnly: boolean
}

export function ClawPlaygroundDetailPanel({
	isSkillsPanelOpen,
	onCloseSkillsPanel,
	detailRef,
	userSelectDetail,
	setUserSelectDetail,
	attachments,
	attachmentList,
	selectedTopic,
	selectedProject,
	activeFileId,
	setActiveFileId,
	handleActiveDetailTabChange,
	setIsDetailPanelFullscreen,
	isReadOnly,
}: ClawPlaygroundDetailPanelProps) {
	if (isSkillsPanelOpen) {
		return <ClawSkillsPanel onClose={onCloseSkillsPanel} />
	}

	return (
		<Detail
			ref={detailRef}
			disPlayDetail={userSelectDetail}
			userSelectDetail={userSelectDetail}
			setUserSelectDetail={setUserSelectDetail}
			attachments={attachments}
			attachmentList={attachmentList}
			topicId={selectedTopic?.id}
			baseShareUrl={`${window.location.origin}/share`}
			currentTopicStatus={selectedTopic?.task_status as TaskStatus | undefined}
			messages={[]}
			allowEdit={!isReadOnly}
			selectedTopic={selectedTopic}
			selectedProject={selectedProject}
			activeFileId={activeFileId}
			onActiveFileChange={setActiveFileId}
			onActiveTabChange={handleActiveDetailTabChange}
			onFullscreenChange={setIsDetailPanelFullscreen}
			projectId={selectedProject.id}
			showFallbackWhenEmpty
		/>
	)
}
