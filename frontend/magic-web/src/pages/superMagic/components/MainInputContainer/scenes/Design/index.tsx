import usePortalTarget from "@/hooks/usePortalTarget"
import { SCENE_INPUT_IDS, SCENE_ANIMATION_CONFIG } from "../../constants"
import { createPortal } from "react-dom"
import type { OptionItem } from "../../panels/types"
import { AnimatePresence, motion } from "framer-motion"
import ScenePanelContainer from "../../components/ScenePanelContainer"
import { observer } from "mobx-react-lite"
import DefaultMessageEditorContainer from "../../components/editors/DefaultMessageEditorContainer"
import { ScenePanelComponentBaseProps } from "../../types"
import { useCurrentSceneConfig } from "../../hooks"

interface DesignInputContainerProps extends ScenePanelComponentBaseProps { }

function DesignInputContainer({ editorContext, editorNodes }: DesignInputContainerProps) {
	const { panels, isLoading } = useCurrentSceneConfig()
	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	const handleTemplateSelect = (_template: OptionItem) => {
		// Reserved for future template selection handling
	}

	return (
		<>
			{editorPortalTarget &&
				editorContext &&
				createPortal(
					<AnimatePresence mode="wait">
						<motion.div
							key="slides-editor"
							initial={SCENE_ANIMATION_CONFIG.initial}
							animate={SCENE_ANIMATION_CONFIG.animate}
							exit={SCENE_ANIMATION_CONFIG.exit}
							transition={SCENE_ANIMATION_CONFIG.transition}
						>
							<DefaultMessageEditorContainer
								editorContext={{
									...editorContext,
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

export default observer(DesignInputContainer)
