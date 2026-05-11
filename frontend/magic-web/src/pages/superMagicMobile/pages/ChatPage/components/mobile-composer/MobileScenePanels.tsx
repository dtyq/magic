import { observer } from "mobx-react-lite"
import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import ScenePanelContainer from "@/pages/superMagic/components/MainInputContainer/components/ScenePanelContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"

interface MobileScenePanelsProps {
	editorContext: SceneEditorContext
}

function MobileScenePanelsComponent({ editorContext }: MobileScenePanelsProps) {
	const { panels, isLoading } = useCurrentSceneConfig({
		topicMode: editorContext.topicMode,
	})

	const handleTemplateSelect = () => undefined
	const handleFilterChange = () => undefined

	return (
		<ScenePanelContainer
			panels={panels}
			loading={isLoading}
			onTemplateSelect={handleTemplateSelect}
			onFilterChange={handleFilterChange}
		/>
	)
}

const MobileScenePanels = observer(MobileScenePanelsComponent)

export default MobileScenePanels
