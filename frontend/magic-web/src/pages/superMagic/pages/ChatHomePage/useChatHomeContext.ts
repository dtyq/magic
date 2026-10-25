import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { ensureChatWorkspace } from "../../hooks/useChatWorkspace"
import SuperMagicService from "../../services"
import { invalidateChatConversationList } from "../../services/chatConversationListInvalidation"
import { takeProjectRenameTask } from "../../services/messageSendRenameTask"
import { topicStore as globalTopicStore } from "../../stores/core"
import { TopicStore } from "../../stores/core/topic"
import type { CreatedProject, ProjectListItem, Workspace } from "../Workspace/types"
import type { SceneEditorContext } from "../../components/MainInputContainer/components/editors/types"

/** Local composer state stays separate from the previously visited project until first send. */
export function useChatHomeContext(): Partial<SceneEditorContext> {
	const { t } = useTranslation("super")
	const [topicStore] = useState(() => new TopicStore())
	const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)
	const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
	const createdProjectRef = useRef<CreatedProject | null>(null)
	const workspaceRef = useRef<Workspace | null>(null)
	const workdirRef = useRef<string>()
	const mountedRef = useRef(true)

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	const createProject = useMemoizedFn<NonNullable<SceneEditorContext["createProject"]>>(
		async (params) => {
			// A later preparation failure must retry in the same project, not create another one.
			if (createdProjectRef.current) return createdProjectRef.current
			// UploadTokenService consumes the temporary directory on the first attempt.
			// Preserve it if workspace lookup or project creation needs a retry.
			workdirRef.current = params.workdir ?? workdirRef.current
			const workspace = await ensureChatWorkspace()
			if (!mountedRef.current) return null
			if (!workspace) {
				magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
				return null
			}
			workspaceRef.current = workspace
			setSelectedWorkspace(workspace)
			const created = await SuperMagicService.project.createProject({
				workspaceId: workspace.id,
				...params,
				workdir: workdirRef.current,
			})
			if (!created?.project || !created.topic) {
				if (mountedRef.current)
					magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
				return null
			}
			createdProjectRef.current = created
			invalidateChatConversationList()
			return mountedRef.current ? created : null
		},
	)

	const onSendSuccess = useMemoizedFn<NonNullable<SceneEditorContext["onSendSuccess"]>>(
		({ currentProject, currentTopic }) => {
			if (!mountedRef.current || !currentProject || !currentTopic) return
			// Smart naming can complete after the local composer has unmounted.
			// Hand its result to the detail store and refresh the independently fetched sidebar list.
			const pendingRename = takeProjectRenameTask(currentProject.id)
			void pendingRename?.then((renamed) => {
				if (!renamed) return
				globalTopicStore.updateTopicName(renamed.topicId, renamed.topicName)
				invalidateChatConversationList()
			})
			void SuperMagicService.switchChatProject(
				currentProject,
				topicStore.selectedTopic ?? currentTopic,
				{
					chatWorkspace: workspaceRef.current,
				},
			)
			invalidateChatConversationList()
		},
	)

	return {
		selectedProject,
		selectedTopic: topicStore.selectedTopic,
		selectedWorkspace,
		setSelectedProject,
		setSelectedTopic: topicStore.setSelectedTopic,
		setSelectedWorkspace,
		topicStore,
		createProject,
		onSendSuccess,
		refreshProjectAfterTopicRename: true,
		// Keep the draft key stable through creation, until dispatch clears the home draft.
		draftKey: {
			workspaceId: "chat-home",
			projectId: "defaultProjectId",
			topicId: "defaultTopicId",
		},
		deferProjectCreationUntilSend: true,
		sceneInputContainerId: "chat-home-input-container",
		allowRecordingMode: false,
		useChatTerminology: true,
		autoFocus: true,
	}
}
