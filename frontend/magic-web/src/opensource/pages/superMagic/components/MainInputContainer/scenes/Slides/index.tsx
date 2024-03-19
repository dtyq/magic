import usePortalTarget from "@/opensource/hooks/usePortalTarget"
import { SCENE_INPUT_IDS, SCENE_ANIMATION_CONFIG } from "../../constants"
import { createPortal } from "react-dom"
import type { OptionItem, FieldItem } from "../../panels/types"
import { AnimatePresence, motion } from "framer-motion"
import ScenePanelContainer from "../../components/ScenePanelContainer"
import { observer } from "mobx-react-lite"
import DefaultMessageEditorContainer from "../../components/editors/DefaultMessageEditorContainer"
import { ScenePanelComponentBaseProps } from "../../types"
import { useCurrentSceneConfig } from "../../hooks"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

interface SlidesInputContainerProps extends ScenePanelComponentBaseProps {}

function SlidesInputContainer({ editorContext, editorNodes }: SlidesInputContainerProps) {
	const { placeholder, panels, isLoading } = useCurrentSceneConfig()
	const isMobile = useIsMobile()

	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	const handleTemplateSelect = (template: OptionItem) => {
		console.log("Template selected:", template)
	}

	const handleFilterChange = (filters: FieldItem[]) => {
		console.log("Filters changed:", filters)
	}

	const editorNode =
		editorPortalTarget &&
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
							placeholder: undefined,
						}}
						editorNodes={editorNodes}
					/>
				</motion.div>
			</AnimatePresence>,
			editorPortalTarget,
		)

	return (
		<>
			{!isMobile && editorNode}
			<ScenePanelContainer
				panels={panels}
				loading={isLoading}
				onTemplateSelect={handleTemplateSelect}
				onFilterChange={handleFilterChange}
			/>
			{isMobile && editorNode}
		</>
	)
}

export default observer(SlidesInputContainer)
