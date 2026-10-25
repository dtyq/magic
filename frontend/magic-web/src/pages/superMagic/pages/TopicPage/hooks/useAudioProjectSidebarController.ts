import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { AudioProjectListItem } from "@/types/audioProject"
import type { AudioRecordingGroup } from "@/services/audioRecordings"
import {
	audioRecordingsService,
	isAudioProjectMode,
	recordingGroupsService,
	UNGROUPED_RECORDING_GROUP_ID,
} from "@/services/audioRecordings"
import { useShareProject } from "@/pages/superMagic/layouts/MainLayout/hooks/useShareProject"
import { useRecordingDetailActions } from "../../AudioRecordings/hooks/useRecordingDetailActions"
import { useAudioRecordingCopyToProject } from "../../AudioRecordings/hooks/useAudioRecordingCopyToProject"

interface UseAudioProjectSidebarControllerInput {
	selectedProject: ProjectListItem | null
	attachments: AttachmentItem[]
	isReadOnly: boolean
	onBack?: () => void
}

/** Centralizes recording-project sidebar state so TopicSidebar remains a presentation component. */
export function useAudioProjectSidebarController({
	selectedProject,
	attachments,
	isReadOnly,
	onBack,
}: UseAudioProjectSidebarControllerInput) {
	const navigate = useNavigate()
	const location = useLocation()
	const isAudioProjectEntry = Boolean(
		(location.state as { isAudioProjectEntry?: boolean } | null)?.isAudioProjectEntry,
	)
	const isAudioProjectModeFlag = isAudioProjectMode(selectedProject?.project_mode)
	const shouldLoadAudioProject = isAudioProjectModeFlag || isAudioProjectEntry
	const [projectItem, setProjectItem] = useState<AudioProjectListItem | null>(null)
	const [title, setTitle] = useState("")
	const [moveGroupOpen, setMoveGroupOpen] = useState(false)
	const [groups, setGroups] = useState<AudioRecordingGroup[]>([])
	const [ungroupedCount, setUngroupedCount] = useState(0)

	const loadProjectItem = useCallback(async () => {
		// Loads the lightweight list row required by project-header actions.
		if (!selectedProject?.id) {
			setProjectItem(null)
			setTitle("")
			return null
		}
		const result = await audioRecordingsService.queryProjects({
			page: 1,
			pageSize: 1,
			keyword: "",
			summaryFilter: "all",
			sortBy: "created_at",
			sortOrder: "desc",
			projectIds: [selectedProject.id],
		})
		const item = result.list[0] ?? null
		setProjectItem(item)
		setTitle(item?.project_name || selectedProject.project_name || "")
		return item
	}, [selectedProject?.id, selectedProject?.project_name])

	useEffect(() => {
		if (!shouldLoadAudioProject) {
			setProjectItem(null)
			setTitle("")
			return
		}
		void loadProjectItem()
	}, [loadProjectItem, shouldLoadAudioProject])

	const isAudioProject = shouldLoadAudioProject || Boolean(projectItem)
	const canManageAudioProject = isAudioProject && !isReadOnly

	const refreshProject = useCallback(async () => {
		// Refreshes the header row after a successful recording mutation.
		await loadProjectItem()
	}, [loadProjectItem])

	const actions = useRecordingDetailActions({
		projectId: selectedProject?.id ?? "",
		projectItem,
		fileMap: null,
		recordingName: title,
		onProjectItemChange: (item) => {
			setProjectItem(item)
			setTitle(item.project_name)
		},
		onRefresh: refreshProject,
	})
	const {
		deleteProject,
		renameProject: renameAudioProject,
		moveToGroup: moveAudioProjectToGroup,
		canGenerateSummary,
		resubmitSummary,
		submitSummary,
	} = actions
	const copyController = useAudioRecordingCopyToProject({ onSuccess: refreshProject })
	const shareController = useShareProject({
		attachments,
		projectName: title,
	})

	useEffect(() => {
		if (!moveGroupOpen) return
		void recordingGroupsService.listGroups().then((result) => {
			setGroups(result.groups)
			setUngroupedCount(result.ungroupedCount)
		})
	}, [moveGroupOpen])

	const handleBack = useCallback(() => {
		// Always returns recording users to the AI recordings list.
		if (onBack) onBack()
		else navigate({ name: RouteName.AudioRecordings })
	}, [navigate, onBack])

	const handleDelete = useCallback(() => {
		// Deletion remains available to the header and is never triggered by passive verification.
		if (canManageAudioProject) void deleteProject()
	}, [canManageAudioProject, deleteProject])

	const renameProject = useCallback(
		async (name: string) => (canManageAudioProject ? renameAudioProject(name) : false),
		[canManageAudioProject, renameAudioProject],
	)
	const moveToGroup = useCallback(
		async (groupId: string) =>
			canManageAudioProject ? moveAudioProjectToGroup(groupId) : false,
		[canManageAudioProject, moveAudioProjectToGroup],
	)
	const copyToProject = useCallback(() => {
		if (projectItem) void copyController.openCopyToProject(projectItem)
	}, [copyController, projectItem])
	const generateSummary = useCallback(() => {
		if (!canManageAudioProject || !canGenerateSummary) return
		if (
			projectItem?.card_status === "summarized" ||
			projectItem?.card_status === "summary_failed"
		) {
			void resubmitSummary()
			return
		}
		void submitSummary()
	}, [
		canGenerateSummary,
		canManageAudioProject,
		projectItem?.card_status,
		resubmitSummary,
		submitSummary,
	])
	const summaryMode =
		projectItem?.card_status === "summarized" || projectItem?.card_status === "summary_failed"
			? "regenerate"
			: "generate"

	return {
		isAudioProject,
		canManageAudioProject,
		projectItem,
		title,
		groups,
		ungroupedCount,
		moveGroupOpen,
		setMoveGroupOpen,
		actions,
		copyController,
		shareController,
		handleBack,
		handleDelete,
		renameProject,
		moveToGroup,
		copyToProject,
		generateSummary,
		summaryMode,
		ungroupedGroupId: UNGROUPED_RECORDING_GROUP_ID,
	}
}
