import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/utils/cn"
import CurrentSceneBadge from "../components/SelectedSkillBadge"
import { SCENE_INPUT_IDS, INPUT_CONTAINER_MIN_HEIGHT, SCENE_PANEL_MIN_HEIGHT } from "../constants"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { observer } from "mobx-react-lite"
import { defaultMCPStore } from "@/components/Agent/MCP/store/mcp-store"
import { useSkillPanelScroll } from "../hooks/useSkillPanelScroll"
import { useSceneSelection } from "../hooks/useSceneSelection"
import LazyScenePanel from "../components/LazyScenePanel"
import SelfMediaComposerConfigPanel from "../components/SelfMediaComposerConfigPanel"
import { shouldShowSelfMediaComposerConfigPanel } from "../utils/selfMediaComposerConfig"
import { roleStore } from "@/pages/superMagic/stores"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import type { SceneEditorContext } from "../components/editors/types"
import type { MessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import {
	buildTopicInputScopeKey,
	SceneStateProvider,
	SceneStateStore,
	sceneStateStore as defaultSceneStateStore,
} from "../stores"
import SuperMagicService from "../../../services"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { userStore } from "@/models/user"

export interface EditorLayoutProps {
	editorContext?: Partial<SceneEditorContext>
	inputContainerId?: string
	mode?: TopicMode
	sceneStateStore?: SceneStateStore
	autoFocus?: boolean
	onAutoFocusHandled?: () => void
}

function EditorLayout({
	editorContext: editorContextOverrides,
	inputContainerId = SCENE_INPUT_IDS.INPUT_CONTAINER,
	mode,
	sceneStateStore = defaultSceneStateStore,
	autoFocus = false,
	onAutoFocusHandled,
}: EditorLayoutProps) {
	const resolvedMode = mode ?? roleStore.currentRole
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const editorRef = useRef<MessageEditorRef>(null)

	// Explicit null is an empty composer, not a request to reuse the global selection.
	const selectedTopic =
		editorContextOverrides?.selectedTopic !== undefined
			? editorContextOverrides.selectedTopic
			: topicStore.selectedTopic
	const selectedProject =
		editorContextOverrides?.selectedProject !== undefined
			? editorContextOverrides.selectedProject
			: projectStore.selectedProject
	const selectedWorkspace =
		editorContextOverrides?.selectedWorkspace !== undefined
			? editorContextOverrides.selectedWorkspace
			: (workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace)

	const scenes = superMagicModeService.getModeConfigWithLegacy(
		resolvedMode,
		undefined,
		false,
		selectedTopic?.agent_code,
	)?.mode.playbooks
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
			// This home screen creates entities inside the workspace selected in the header.
			creationScene: "workspace",
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: projectStore.setSelectedProject,
			topicMode: resolvedMode,
			setTopicMode: roleStore.setCurrentRole,
			recoverTopicMode: roleStore.applyResolvedRole,
			topicExamplesMode: resolvedMode,
			enableMessageSendByContent: true,
			autoFocus,
			onEditorFocus: onAutoFocusHandled,
			onSendSuccess: ({ currentProject, currentTopic }) => {
				if (!selectedWorkspace || !currentProject || !currentTopic) return

				SuperMagicService.route.navigateToTopic({
					workspaceId: selectedWorkspace.id,
					projectId: currentProject.id,
					topicId: currentTopic.id,
				})
			},
			editorRef,
			modules: {
				upload: {
					confirmDelete: false,
				},
			},
			...editorContextOverrides,
		}),
		[
			editorContextOverrides,
			resolvedMode,
			selectedTopic,
			selectedProject,
			selectedWorkspace,
			autoFocus,
			onAutoFocusHandled,
		],
	)

	// Automatically scroll to scene panel when scene config loaded
	useSkillPanelScroll(editorContainerRef, sceneStateStore)

	// Warm the MCP list after first paint, so the composer's MCP controls open with data ready.
	useEffect(() => {
		const run = () => {
			defaultMCPStore.load().catch(console.error)
		}
		let scheduledId: number
		let usedIdleCallback = false
		if (typeof requestIdleCallback !== "undefined") {
			usedIdleCallback = true
			scheduledId = requestIdleCallback(run, { timeout: 2500 })
		} else {
			scheduledId = window.setTimeout(run, 1)
		}
		return () => {
			if (usedIdleCallback && typeof cancelIdleCallback !== "undefined") {
				cancelIdleCallback(scheduledId)
			} else {
				window.clearTimeout(scheduledId)
			}
		}
	}, [])

	useEffect(() => {
		sceneStateStore.resetState()
	}, [sceneStateStore, organizationCode, userId])

	useEffect(() => {
		sceneStateStore.setInputScopeKey(
			buildTopicInputScopeKey(
				String(resolvedMode),
				selectedTopic?.id ?? "",
				selectedTopic?.agent_code ?? "",
			),
		)
	}, [resolvedMode, selectedTopic?.id, selectedTopic?.agent_code, sceneStateStore])

	const { currentScene: selectedScene, shouldShowCurrentSceneBadge } = useSceneSelection({
		scenes,
		sceneStateStore,
	})
	const shouldShowSelfMediaConfig = shouldShowSelfMediaComposerConfigPanel({
		context: editorContext,
		hasSelectedScene: Boolean(selectedScene),
		hasAvailableScenes: Boolean(scenes?.length),
		variant: ScenePanelVariant.HomePage,
	})

	return (
		<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.HomePage}>
			<div className={cn("flex size-full flex-col items-center")}>
				{/* Main Input Container */}
				<div
					className="w-full max-w-4xl rounded-2xl border border-border bg-sidebar p-2"
					data-guide-anchor="message-composer"
				>
					{/* skill editor input container with min height to prevent layout shift */}
					<div
						ref={editorContainerRef}
						id={inputContainerId}
						style={{ minHeight: INPUT_CONTAINER_MIN_HEIGHT.HomePage }}
					></div>

					{/* Selected Skill Badge */}
					{shouldShowCurrentSceneBadge && selectedScene ? (
						<div className="mt-2">
							<CurrentSceneBadge
								scene={selectedScene}
								onClose={() => {
									sceneStateStore.setCurrentScene(null)
								}}
							/>
						</div>
					) : null}
				</div>

				{/* skill config container with smooth transition */}
				<div
					data-testid="home-scene-config-container"
					className={cn(
						"w-full transition-all duration-200 ease-in-out",
						resolvedMode !== TopicMode.PPT && "max-w-4xl",
						shouldShowSelfMediaConfig ? "px-2 pb-8 pt-0" : "p-2 pb-[40px]",
					)}
					style={{
						minHeight: selectedScene ? SCENE_PANEL_MIN_HEIGHT.HomePage : undefined,
					}}
				>
					<LazyScenePanel
						scenes={scenes}
						editorContext={editorContext}
						inputContainerId={inputContainerId}
					/>
					{shouldShowSelfMediaConfig ? <SelfMediaComposerConfigPanel /> : null}
				</div>
			</div>
		</SceneStateProvider>
	)
}

export default observer(EditorLayout)
