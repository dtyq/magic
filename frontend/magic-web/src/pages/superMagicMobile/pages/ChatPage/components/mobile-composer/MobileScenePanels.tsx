import { observer } from "mobx-react-lite"
import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import ScenePanelContainer from "@/pages/superMagic/components/MainInputContainer/components/ScenePanelContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { cn } from "@/lib/utils"

interface MobileScenePanelsProps {
	editorContext: SceneEditorContext
	compact?: boolean
}

function MobileScenePanelsComponent({ editorContext, compact = false }: MobileScenePanelsProps) {
	const { panels, isLoading } = useCurrentSceneConfig({
		topicMode: editorContext.topicMode,
	})

	const handleTemplateSelect = () => undefined
	const handleFilterChange = () => undefined

	if (!isLoading && panels.length === 0) return null

	return (
		<div
			className={cn("min-w-0 flex-1", compact && "flex items-center overflow-hidden")}
			data-testid={compact ? "mobile-scene-panels-compact" : "mobile-scene-panels"}
		>
			<ScenePanelContainer
				panels={panels}
				loading={isLoading}
				onTemplateSelect={handleTemplateSelect}
				onFilterChange={handleFilterChange}
				compact={compact}
			/>
		</div>
	)
}

const MobileScenePanels = observer(MobileScenePanelsComponent)

export default MobileScenePanels
