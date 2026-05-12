import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import RecordSummaryEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/RecordSummaryEditorContainer"
import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import { RecordingSummaryEditorMode } from "@/pages/superMagic/components/MessagePanel/const/recordSummary"
import useRecordingSummaryEditorMode from "@/pages/superMagic/components/MessagePanel/hooks/useRecordingSummaryEditorMode"
import useResolvedEditorStore from "@/pages/superMagic/components/MessageEditor/hooks/useResolvedEditorStore"
import { MessageEditorStoreProvider } from "@/pages/superMagic/components/MessageEditor/stores"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { roleStore } from "@/pages/superMagic/stores"
import type { SceneItem } from "@/pages/superMagic/types/skill"
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
	const { editorMode } = useRecordingSummaryEditorMode({
		selectedTopic,
		hasMessage: (editorContext.messagesLength ?? 0) > 0,
	})
	const { placeholder } = useCurrentSceneConfig({
		topicMode: editorContext.topicMode,
	})
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
						scenes={scenes}
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
					scenes={scenes}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					topicMode={effectiveTopicMode}
					agentCode={editorContext.agentCode ?? selectedTopic?.agent_code}
					onModeChange={editorContext.setTopicMode}
				/>

				<div
					className="overflow-hidden rounded-3xl bg-background shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
					data-testid="mobile-record-summary-card"
				>
					<div className="border-b border-border px-3 pb-2 pt-2 [&:empty]:hidden">
						<MobileScenePanels editorContext={routeEditorContext} />
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
