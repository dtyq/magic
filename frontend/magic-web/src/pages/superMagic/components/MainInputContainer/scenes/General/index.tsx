import usePortalTarget from "@/hooks/usePortalTarget"
import { SCENE_INPUT_IDS, SCENE_ANIMATION_CONFIG } from "../../constants"
import { createPortal } from "react-dom"
import SceneSwitcher from "../../components/SceneSwitcher"
import { AnimatePresence, motion } from "framer-motion"
import { SceneItem } from "@/pages/superMagic/types/skill"
import DefaultMessageEditorContainer from "../../components/editors/DefaultMessageEditorContainer"
import { ScenePanelComponentBaseProps } from "../../types"
import { ScenePanelVariant } from "../../components/LazyScenePanel/types"
import { useOptionalScenePanelVariant, useSceneStateStore } from "../../stores"

interface GeneralInputContainerProps extends ScenePanelComponentBaseProps {
	scenes: SceneItem[] | undefined
}

function GeneralInputContainer({ scenes, editorContext, editorNodes }: GeneralInputContainerProps) {
	const sceneStateStore = useSceneStateStore()
	const variant = useOptionalScenePanelVariant()
	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	const scenesSwitcherPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.SCENES_SWITCHER,
	})

	const renderScenesSwitcher = () => {
		if (variant && [ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant)) {
			return (
				scenesSwitcherPortalTarget &&
				createPortal(
					<SceneSwitcher
						scenes={scenes}
						onSceneClick={sceneStateStore.setCurrentScene}
					/>,
					scenesSwitcherPortalTarget,
				)
			)
		}

		return <SceneSwitcher scenes={scenes} onSceneClick={sceneStateStore.setCurrentScene} />
	}

	return (
		<>
			{editorPortalTarget &&
				createPortal(
					<AnimatePresence mode="wait">
						<motion.div
							key="general-editor"
							initial={SCENE_ANIMATION_CONFIG.initial}
							animate={SCENE_ANIMATION_CONFIG.animate}
							exit={SCENE_ANIMATION_CONFIG.exit}
							transition={SCENE_ANIMATION_CONFIG.transition}
						>
							<DefaultMessageEditorContainer
								editorContext={editorContext}
								editorNodes={editorNodes}
							/>
						</motion.div>
					</AnimatePresence>,
					editorPortalTarget,
				)}
			{renderScenesSwitcher()}
		</>
	)
}

export default GeneralInputContainer
