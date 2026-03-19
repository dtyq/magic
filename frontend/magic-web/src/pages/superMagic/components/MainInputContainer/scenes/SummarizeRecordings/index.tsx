import usePortalTarget from "@/hooks/usePortalTarget"
import { SCENE_INPUT_IDS, SCENE_ANIMATION_CONFIG } from "../../constants"
import { createPortal } from "react-dom"
import type { FieldItem, OptionItem } from "../../panels/types"
import { AnimatePresence, motion } from "framer-motion"
import ScenePanelContainer from "../../components/ScenePanelContainer"
import { observer } from "mobx-react-lite"
import RecordSummaryEditorContainer from "../../components/editors/RecordSummaryEditorContainer"
import { ScenePanelComponentBaseProps } from "../../types"
import { useCurrentSceneConfig } from "../../hooks"

interface SummarizeRecordingsInputContainerProps extends ScenePanelComponentBaseProps { }

function SummarizeRecordingsInputContainer({
	editorContext,
	editorNodes,
}: SummarizeRecordingsInputContainerProps) {
	const { placeholder, panels, isLoading } = useCurrentSceneConfig()
	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	const handleScenarioSelect = (scenario: OptionItem) => {
		console.log("Scenario selected:", scenario)
		// TODO: implement scenario switching logic
	}

	const handleFilterChange = (filters: FieldItem[]) => {
		console.log("Filters changed:", filters)
	}

	return (
		<>
			{editorPortalTarget &&
				editorContext &&
				createPortal(
					<AnimatePresence mode="wait">
						<motion.div
							key="summarize-recordings-editor"
							initial={SCENE_ANIMATION_CONFIG.initial}
							animate={SCENE_ANIMATION_CONFIG.animate}
							exit={SCENE_ANIMATION_CONFIG.exit}
							transition={SCENE_ANIMATION_CONFIG.transition}
						>
							<RecordSummaryEditorContainer
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
				onTemplateSelect={handleScenarioSelect}
				onFilterChange={handleFilterChange}
				loading={isLoading}
			/>
		</>
	)
}

export default observer(SummarizeRecordingsInputContainer)
