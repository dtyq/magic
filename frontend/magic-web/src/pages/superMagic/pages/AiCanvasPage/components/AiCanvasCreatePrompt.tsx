import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import EditorLayout from "@/pages/superMagic/components/MainInputContainer/scenes/EditorLayout"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import {
	SceneStateProvider,
	createSceneStateStore,
	sceneStateStore as sharedSceneStateStore,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import { ScenePanelVariant } from "@/pages/superMagic/components/MainInputContainer/components/LazyScenePanel/types"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { CreatedProject, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import {
	buildAiCanvasMention,
	createAiCanvasDocument,
	getAiCanvasDefaultFolderName,
} from "@/pages/superMagic/pages/TopicPage/utils/aiCanvas"
import { openAiCanvasProject } from "../utils/openAiCanvasProject"

interface AiCanvasCreatePromptProps {
	/** The ai-canvas workspace; sending is disabled until it is loaded. */
	workspace: Workspace | null
	/** H5: the mobile composer docked at the bottom of the page instead of the desktop one. */
	mobile?: boolean
}

const noopTopicModeChange = () => undefined

/**
 * "Describe and create" composer of the AI canvas home.
 *
 * Reuses the task home's EditorLayout locked to the design mode, so the design employee's
 * playbook chips and their scene panels (guide, fields, inspiration) appear exactly as on the
 * task home. Only creation is overridden:
 * create the ai-canvas project → create its default canvas → bind that canvas as an implicit
 * mention → send with the design mode → open the project. If the canvas cannot be created the
 * send is aborted, so the agent never starts without a canvas path.
 *
 * On H5 the same creation flow drives the mobile composer, which (like the micro-app H5 home)
 * expects a complete editor context and the shared scene state the mobile composer reads.
 */
function AiCanvasCreatePrompt({ workspace, mobile = false }: AiCanvasCreatePromptProps) {
	const { t } = useTranslation("aiCanvas")
	// Desktop gets isolated scene state so the home composer shares no playbook state with other
	// pages; the mobile composer works on the shared store.
	const [sceneStateStore] = useState(() =>
		mobile ? sharedSceneStateStore : createSceneStateStore(),
	)
	// Canvas mention per created project, consumed by getImplicitMentionItems in the same send.
	const canvasMentionsRef = useRef(new Map<string, MentionListItem>())

	useEffect(() => {
		// The home composer always creates a new project; never reuse a previously opened one.
		projectStore.setSelectedProject(null)
		topicStore.setSelectedTopic(null)
	}, [])

	const editorContext = useMemo<Partial<SceneEditorContext>>(
		() => ({
			selectedWorkspace: workspace,
			selectedProject: null,
			selectedTopic: null,
			// The AI canvas always talks to the design employee: mode switching is disabled.
			setTopicMode: noopTopicModeChange,
			recoverTopicMode: noopTopicModeChange,
			showModeToggle: false,
			modelTopicMode: TopicMode.Design,
			placeholder: t("home.placeholder"),
			createProject: async ({ workdir }): Promise<CreatedProject | null> => {
				if (!workspace?.id) return null
				try {
					const created = await SuperMagicApi.createAiCanvasProject({
						workspace_id: String(workspace.id),
						// Starts with the same name as its canvas, which then follows renames.
						project_name: getAiCanvasDefaultFolderName(),
						workdir,
					})
					const canvas = await createAiCanvasDocument(String(created.project.id))
					canvasMentionsRef.current.set(
						String(created.project.id),
						buildAiCanvasMention({
							...canvas.folder,
							display_config: { type: "design" },
						}),
					)
					return { project: created.project, topic: created.topic }
				} catch (error) {
					magicToast.error(t("home.createFailed"))
					return null
				}
			},
			getImplicitMentionItems: (project) => {
				const mention = canvasMentionsRef.current.get(String(project.id))
				return mention ? [mention] : []
			},
			onSendSuccess: ({ currentProject }) => {
				if (!currentProject) return
				canvasMentionsRef.current.delete(String(currentProject.id))
				void openAiCanvasProject(currentProject)
			},
		}),
		[t, workspace],
	)

	const mobileEditorContext = useMemo<SceneEditorContext>(
		() => ({
			...editorContext,
			selectedWorkspace: workspace,
			selectedProject: null,
			selectedTopic: null,
			draftKey: createMessageEditorDraftKey({
				selectedWorkspace: workspace,
				selectedProject: null,
				selectedTopic: null,
			}),
			setSelectedWorkspace: workspaceStore.setSelectedWorkspace,
			setSelectedProject: projectStore.setSelectedProject,
			setSelectedTopic: topicStore.setSelectedTopic,
			topicMode: TopicMode.Design,
			enableMessageSendByContent: true,
			size: "mobile",
			showModelSelector: true,
			layoutConfig: {
				topBarLeft: [ToolbarButton.AT],
				bottomLeft: [ToolbarButton.MODEL_SWITCH],
				bottomRight: [
					ToolbarButton.UPLOAD,
					ToolbarButton.DIVIDER,
					ToolbarButton.VOICE_INPUT,
					ToolbarButton.SEND_BUTTON,
				],
			},
			modules: {
				upload: { confirmDelete: false },
			},
		}),
		[editorContext, workspace],
	)

	if (mobile) {
		return (
			<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.Mobile}>
				<div className="w-full" data-testid="ai-canvas-create-prompt-mobile">
					{/* Same draft-key reason as desktop: mount once the workspace is known. */}
					{workspace ? (
						<MobileInputContainer editorContext={mobileEditorContext} />
					) : null}
				</div>
			</SceneStateProvider>
		)
	}

	return (
		<div className="w-full" data-testid="ai-canvas-create-prompt">
			{workspace ? (
				<EditorLayout
					mode={TopicMode.Design}
					editorContext={editorContext}
					sceneStateStore={sceneStateStore}
				/>
			) : (
				// The editor keys its draft by workspace. Mounting it before the ai-canvas workspace
				// loads would restore the "defaultWorkspaceId" draft, then clear it when the real key
				// arrives, so a stale prompt flashed on refresh. Until then, an empty shell of the
				// composer's size (outline and shadow as in AiCanvasComposerFrame) holds its place.
				<div
					className="h-[150px] w-full rounded-[20px] border border-border bg-background shadow-[0_16px_48px_-16px_rgb(15_23_42/0.16)]"
					aria-busy="true"
				/>
			)}
		</div>
	)
}

export default observer(AiCanvasCreatePrompt)
