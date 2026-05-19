import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import RecordSummaryEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/RecordSummaryEditorContainer"
import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import { useSceneSelection } from "@/pages/superMagic/components/MainInputContainer/hooks"
import { sceneStateStore } from "@/pages/superMagic/components/MainInputContainer/stores"
import { RecordingSummaryEditorMode } from "@/pages/superMagic/components/MessagePanel/const/recordSummary"
import useRecordingSummaryEditorMode from "@/pages/superMagic/components/MessagePanel/hooks/useRecordingSummaryEditorMode"
import useResolvedEditorStore from "@/pages/superMagic/components/MessageEditor/hooks/useResolvedEditorStore"
import { MessageEditorStoreProvider } from "@/pages/superMagic/components/MessageEditor/stores"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { roleStore } from "@/pages/superMagic/stores"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import MobileComposer from "../mobile-composer/MobileComposer"
import MobileComposerHeader from "../mobile-composer/MobileComposerHeader"
import MobileScenePanels from "../mobile-composer/MobileScenePanels"

interface MobileRecordSummaryRouteProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	scenes?: SceneItem[]
}

function MobileRecordSummaryRouteComponent({
	editorContext,
	editorNodes,
	scenes,
}: MobileRecordSummaryRouteProps) {
	const selectedTopic = editorContext.selectedTopic ?? topicStore.selectedTopic
	const selectedProject = editorContext.selectedProject ?? projectStore.selectedProject
	const effectiveTopicMode = editorContext.topicMode ?? roleStore.currentRole
	const effectiveScenes =
		scenes ??
		superMagicModeService.getModeConfigWithLegacy(
			effectiveTopicMode,
			undefined,
			false,
			editorContext.agentCode ?? selectedTopic?.agent_code,
		)?.mode.playbooks
	const { hasOnlyScene } = useSceneSelection({
		scenes: effectiveScenes,
		sceneStateStore,
	})
	const { editorMode } = useRecordingSummaryEditorMode({
		selectedTopic,
		hasMessage: (editorContext.messagesLength ?? 0) > 0,
	})
	const {
		placeholder,
		panels: currentScenePanels,
		isLoading: isScenePanelLoading,
	} = useCurrentSceneConfig({
		topicMode: editorContext.topicMode,
	})
	const hasScenePanels = isScenePanelLoading || currentScenePanels.length > 0
	const shouldRenderPanelsInHeader = hasOnlyScene || (!effectiveScenes?.length && hasScenePanels)
	const { store } = useResolvedEditorStore({
		mentionPanelStore: editorContext.mentionPanelStore,
		projectFilesStore: editorContext.projectFilesStore,
		topicModelStore: editorContext.topicModelStore,
	})

	const routeEditorContext = useMemo<SceneEditorContext>(
		() => ({
			...editorContext,
			placeholder: placeholder ?? editorContext.placeholder,
			modelSwitch: <></>,
		}),
		[editorContext, placeholder],
	)
	const headerScenePanelsNode = shouldRenderPanelsInHeader ? (
		<MobileScenePanels editorContext={routeEditorContext} compact />
	) : null

	if (editorMode === RecordingSummaryEditorMode.Editing) {
		return (
			<div
				className="flex w-full flex-col gap-2 px-2 pb-3 pt-2"
				data-testid="mobile-record-summary-route-editing"
			>
				<div
					className="overflow-hidden rounded-3xl bg-background shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
					data-testid="mobile-record-summary-editing-card"
				>
					<MobileComposer
						editorContext={routeEditorContext}
						editorNodes={editorNodes}
						scenes={effectiveScenes}
					/>
				</div>
			</div>
		)
	}

	return (
		<MessageEditorStoreProvider store={store}>
			<div
				className="flex w-full flex-col gap-2 px-2 pb-3 pt-2"
				data-testid="mobile-record-summary-route"
			>
				<MobileComposerHeader
					scenes={effectiveScenes}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					topicMode={effectiveTopicMode}
					agentCode={editorContext.agentCode ?? selectedTopic?.agent_code}
					sceneControlNode={headerScenePanelsNode}
					onModeChange={editorContext.setTopicMode}
				/>

				<div
					className="overflow-hidden rounded-3xl bg-background shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
					data-testid="mobile-record-summary-card"
				>
					<div className="border-b border-border px-3 pb-2 pt-2 [&:empty]:hidden">
						{shouldRenderPanelsInHeader ? null : (
							<MobileScenePanels editorContext={routeEditorContext} />
						)}
					</div>
					<RecordSummaryEditorContainer
						editorContext={routeEditorContext}
						editorNodes={editorNodes}
					/>
				</div>
			</div>
		</MessageEditorStoreProvider>
	)
}

const MobileRecordSummaryRoute = observer(MobileRecordSummaryRouteComponent)

export default MobileRecordSummaryRoute
