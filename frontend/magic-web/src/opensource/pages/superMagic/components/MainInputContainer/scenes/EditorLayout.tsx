import { useEffect, useMemo, useRef, useState } from "react"
import { useMount } from "ahooks"
import PluginTips from "../components/PluginTips"
import { AgentCommonModal } from "@/opensource/components/Agent/AgentCommonModal"
import AgentSettings from "@/opensource/components/Agent/MCP/AgentSettings"
import CurrentSceneBadge from "../components/SelectedSkillBadge"
import { SCENE_INPUT_IDS, INPUT_CONTAINER_MIN_HEIGHT } from "../constants"
import { TopicMode } from "../../../pages/Workspace/types"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"
import { observer } from "mobx-react-lite"
import { defaultMCPStore } from "@/opensource/components/Agent/MCP/store/mcp-store"
import { useSkillPanelScroll } from "../hooks/useSkillPanelScroll"
import LazyScenePanel from "../components/LazyScenePanel"
import { roleStore } from "@/opensource/pages/superMagic/stores"
import { projectStore, topicStore, workspaceStore } from "@/opensource/pages/superMagic/stores/core"
import type { SceneEditorContext } from "../components/editors/types"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import {
	SceneStateProvider,
	SceneStateStore,
	sceneStateStore as defaultSceneStateStore,
} from "../stores"
import SuperMagicService from "../../../services"
import { createMessageEditorDraftKey } from "@/opensource/pages/superMagic/components/MessageEditor/utils/draftKey"
import { userStore } from "@/opensource/models/user"

interface EditorLayoutProps {
	mode?: TopicMode
	sceneStateStore?: SceneStateStore
}

function EditorLayout({
	mode = TopicMode.General,
	sceneStateStore = defaultSceneStateStore,
}: EditorLayoutProps) {
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const [mcpModalOpen, setMcpModalOpen] = useState(false)

	const scenes = superMagicModeService.getModeConfigWithLegacy(mode)?.mode.playbooks
	const selectedScene = sceneStateStore.currentScene
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject
	const selectedWorkspace = workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace
	const organizationCode = userStore.user.organizationCode
	const userId = userStore.user.userInfo?.user_id
	const editorContext = useMemo<SceneEditorContext>(
		() => ({
			draftKey: createMessageEditorDraftKey({
				selectedWorkspace,
				selectedProject,
				selectedTopic,
			}),
			selectedTopic,
			selectedProject,
			selectedWorkspace,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: projectStore.setSelectedProject,
			topicMode: mode,
			setTopicMode: roleStore.setCurrentRole,
			topicExamplesMode: mode,
			enableMessageSendByContent: true,
			onSendSuccess: ({ currentProject, currentTopic }) => {
				if (!selectedWorkspace || !currentProject || !currentTopic) return

				SuperMagicService.route.navigateToTopic({
					workspaceId: selectedWorkspace.id,
					projectId: currentProject.id,
					topicId: currentTopic.id,
				})
			},
			modules: {
				upload: {
					confirmDelete: false,
				},
			},
		}),
		[mode, selectedTopic, selectedProject, selectedWorkspace],
	)

	// Automatically scroll to scene panel when scene config loaded
	useSkillPanelScroll(editorContainerRef, sceneStateStore)

	useMount(() => {
		defaultMCPStore.load().catch(console.error)
	})

	useEffect(() => {
		sceneStateStore.resetState()
	}, [sceneStateStore, organizationCode, userId])

	useEffect(() => {
		const currentScene = sceneStateStore.currentScene
		if (!currentScene || !scenes) return

		const isSceneValid = scenes.some((scene) => scene.id === currentScene.id)
		if (!isSceneValid) {
			sceneStateStore.setCurrentScene(null)
		}
	}, [mode, sceneStateStore, scenes, sceneStateStore.currentScene])

	const shouldShowPluginTips =
		!selectedScene && defaultMCPStore.initialized && !defaultMCPStore.hasMCP

	return (
		<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.HomePage}>
			<div className="flex size-full max-w-4xl flex-col items-center gap-4">
				{/* Main Input Container */}
				<div className="w-full rounded-2xl border border-border bg-sidebar p-2">
					{/* skill editor input container with min height to prevent layout shift */}
					<div
						ref={editorContainerRef}
						id={SCENE_INPUT_IDS.INPUT_CONTAINER}
						style={{ minHeight: INPUT_CONTAINER_MIN_HEIGHT.HomePage }}
					></div>

					{/* Plugin Tips or Selected Skill Badge */}
					<div className="mt-2 [&:empty]:hidden">
						{selectedScene ? (
							<CurrentSceneBadge
								scene={selectedScene}
								onClose={() => {
									sceneStateStore.setCurrentScene(null)
								}}
							/>
						) : shouldShowPluginTips ? (
							<PluginTips onConnectClick={() => setMcpModalOpen(true)} />
						) : null}
					</div>
				</div>

				{/* skill config container with smooth transition */}
				<div className="w-full p-2 pb-[160px] transition-all duration-200 ease-in-out">
					<LazyScenePanel scenes={scenes} editorContext={editorContext} />
				</div>
			</div>
			<AgentCommonModal
				open={mcpModalOpen}
				onOpenChange={setMcpModalOpen}
				width={900}
				footer={null}
				closable={false}
			>
				<AgentSettings onClose={() => setMcpModalOpen(false)} />
			</AgentCommonModal>
		</SceneStateProvider>
	)
}

export default observer(EditorLayout)
