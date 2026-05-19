import { lazy, Suspense, useState } from "react"
import { observer } from "mobx-react-lite"
import { SceneEditorKey, SceneItem } from "@/pages/superMagic/types/skill"
import SkillPanelSkeleton from "../skeleton/SkillPanelSkeleton"
import {
	MessageEditorStore,
	MessageEditorStoreProvider,
} from "@/pages/superMagic/components/MessageEditor/stores"
import { ScenePanelComponentBaseProps } from "../../types"
import { useOptionalScenePanelVariant } from "../../stores"
import { useCurrentSceneConfig } from "../../hooks"

// Lazy load skill container components
const SummarizeRecordingsInputContainer = lazy(() => import("../../scenes/SummarizeRecordings"))
const DefaultInputContainer = lazy(() => import("../../scenes/Default"))
const GeneralInputContainer = lazy(() => import("../../scenes/General"))

interface LazyScenePanelProps extends ScenePanelComponentBaseProps {
	scenes?: SceneItem[]
}

/**
 * Lazy loaded skill panel component with loading skeleton
 * Shows skeleton when config is loading or component is lazy loading
 */
function LazyScenePanel({ scenes, editorContext, editorNodes }: LazyScenePanelProps) {
	const variant = useOptionalScenePanelVariant()
	const { isLoading, editorType } = useCurrentSceneConfig({
		topicMode: editorContext?.topicMode,
	})

	const [sharedEditorStore] = useState(() => new MessageEditorStore())

	const renderContent = () => {
		const commonProps = { editorContext, editorNodes }

		if (isLoading) {
			return <SkillPanelSkeleton includeEditor variant={variant} />
		}

		if (editorType) {
			switch (editorType) {
				case SceneEditorKey.RecordSummary:
					return <SummarizeRecordingsInputContainer key={editorType} {...commonProps} />
				case SceneEditorKey.General:
				default:
					return <DefaultInputContainer key={editorType} {...commonProps} />
			}
		}

		return <GeneralInputContainer scenes={scenes} {...commonProps} />
	}

	return (
		<MessageEditorStoreProvider store={sharedEditorStore}>
			<Suspense fallback={<SkillPanelSkeleton includeEditor variant={variant} />}>
				{renderContent()}
			</Suspense>
		</MessageEditorStoreProvider>
	)
}

export default observer(LazyScenePanel)
