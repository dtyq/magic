import usePortalTarget from "@/opensource/hooks/usePortalTarget"
import { SCENE_INPUT_IDS, SCENE_ANIMATION_CONFIG } from "../../constants"
import { createPortal } from "react-dom"
import type { OptionItem } from "../../panels/types"
import { AnimatePresence, motion } from "framer-motion"
import ScenePanelContainer from "../../components/ScenePanelContainer"
import { observer } from "mobx-react-lite"
import DefaultMessageEditorContainer from "../../components/editors/DefaultMessageEditorContainer"
import { ScenePanelComponentBaseProps } from "../../types"
import { useCurrentSceneConfig } from "../../hooks"

interface AnalyzeDataInputContainerProps extends ScenePanelComponentBaseProps {}

function AnalyzeDataInputContainer({ editorContext, editorNodes }: AnalyzeDataInputContainerProps) {
	const { placeholder, panels, isLoading } = useCurrentSceneConfig()
	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	const handleTemplateSelect = (template: OptionItem) => {
		console.log("Template selected:", template)
	}

	return (
		<>
			{editorPortalTarget &&
				editorContext &&
				createPortal(
					<AnimatePresence mode="wait">
						<motion.div
							key="analyze-data-editor"
							initial={SCENE_ANIMATION_CONFIG.initial}
							animate={SCENE_ANIMATION_CONFIG.animate}
							exit={SCENE_ANIMATION_CONFIG.exit}
							transition={SCENE_ANIMATION_CONFIG.transition}
						>
							<DefaultMessageEditorContainer
								editorContext={{
									...editorContext,
									placeholder,
								}}
								editorNodes={editorNodes}
							/>
						</motion.div>
					</AnimatePresence>,
					editorPortalTarget,
				)}
			<ScenePanelContainer
				panels={panels}
				onTemplateSelect={handleTemplateSelect}
				loading={isLoading}
			/>
		</>
	)
}

export default observer(AnalyzeDataInputContainer)
