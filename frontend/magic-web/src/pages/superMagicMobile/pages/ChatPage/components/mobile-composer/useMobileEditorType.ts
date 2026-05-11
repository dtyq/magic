import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { SceneEditorKey } from "@/pages/superMagic/types/skill"

interface UseMobileEditorTypeParams {
	editorContext: SceneEditorContext
}

export interface MobileEditorTypeState {
	editorType: SceneEditorKey | undefined
	isGeneralEditor: boolean
	isRecordSummaryEditor: boolean
}

export default function useMobileEditorType({
	editorContext,
}: UseMobileEditorTypeParams): MobileEditorTypeState {
	const { editorType } = useCurrentSceneConfig({
		topicMode: editorContext.topicMode,
	})

	return {
		editorType,
		isGeneralEditor: !editorType || editorType === SceneEditorKey.General,
		isRecordSummaryEditor: editorType === SceneEditorKey.RecordSummary,
	}
}
