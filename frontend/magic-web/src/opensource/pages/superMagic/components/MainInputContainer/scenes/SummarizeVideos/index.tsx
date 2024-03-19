import usePortalTarget from "@/opensource/hooks/usePortalTarget"
import { SCENE_INPUT_IDS, SCENE_ANIMATION_CONFIG } from "../../constants"
import { createPortal } from "react-dom"
import type { OptionItem } from "../../panels/types"
import { AnimatePresence, motion } from "framer-motion"
import { useLocaleText } from "../../panels/hooks/useLocaleText"
import ScenePanelContainer from "../../components/ScenePanelContainer"
import VideoInputEditor from "./components/VideoInputEditor"
import { observer } from "mobx-react-lite"
import { ScenePanelComponentBaseProps } from "../../types"
import { useCurrentSceneConfig } from "../../hooks"

interface SummarizeVideosInputContainerProps extends ScenePanelComponentBaseProps {}

function SummarizeVideosInputContainer(_props: SummarizeVideosInputContainerProps) {
	void _props
	const { sceneConfig: skillConfig, panels, isLoading } = useCurrentSceneConfig()
	const lt = useLocaleText()
	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	const handleTemplateSelect = (template: OptionItem) => {
		console.log("Template selected:", template)
	}

	const handleVideoSubmit = (videoUrl: string) => {
		console.log("Video URL submitted:", videoUrl)
	}

	const handleFileUpload = (file: File) => {
		console.log("File uploaded:", file)
	}

	return (
		<>
			{editorPortalTarget &&
				createPortal(
					<AnimatePresence mode="wait">
						<motion.div
							key="summarize-videos-editor"
							initial={SCENE_ANIMATION_CONFIG.initial}
							animate={SCENE_ANIMATION_CONFIG.animate}
							exit={SCENE_ANIMATION_CONFIG.exit}
							transition={SCENE_ANIMATION_CONFIG.transition}
						>
							<VideoInputEditor
								placeholder={lt(skillConfig?.placeholder)}
								onVideoSubmit={handleVideoSubmit}
								onFileUpload={handleFileUpload}
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

export default observer(SummarizeVideosInputContainer)
