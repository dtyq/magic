import { motion, useReducedMotion } from "framer-motion"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import SlidesTemplatePromptDock from "./SlidesTemplatePromptDock"

interface SlidesTemplatesPromptRegionProps {
	selectedTemplate: OptionItem | null
	onClearSelectedTemplate: () => void
	onFindSimilarColors?: (template: OptionItem) => void
	onPreviewSelectedTemplate: () => void
}

export default function SlidesTemplatesPromptRegion({
	selectedTemplate,
	onClearSelectedTemplate,
	onFindSimilarColors,
	onPreviewSelectedTemplate,
}: SlidesTemplatesPromptRegionProps) {
	const reduceMotion = useReducedMotion()

	return (
		<div
			className={
				selectedTemplate
					? "relative grid grid-rows-[1fr]"
					: "relative grid grid-rows-[0fr] transition-none"
			}
			data-testid="slides-templates-page-prompt-region"
		>
			<div className="min-h-0 overflow-hidden">
				{/*
				 * 提前挂载编辑器，首次选择模板时只切换可见性，避免初始化导致整页闪动。
				 * The onboarding run's last step points here: this panel holds the template the guide
				 * picked and the editor where the request is described, and it is the only thing on
				 * the page that says both. It is also always mounted — the run may have picked
				 * nothing, in which case the panel is only an empty row — so the step's anchor is
				 * never missing, only small.
				 */}
				<motion.div
					initial={false}
					animate={{
						opacity: selectedTemplate ? 1 : 0,
						y: selectedTemplate ? 0 : 6,
					}}
					transition={
						reduceMotion
							? { duration: 0 }
							: { duration: 0.14, ease: [0.22, 1, 0.36, 1] }
					}
					className={
						selectedTemplate
							? "flex flex-col"
							: "pointer-events-none invisible flex flex-col"
					}
					aria-hidden={!selectedTemplate}
					data-testid="slides-templates-page-prompt-panel"
					data-guide-anchor={HomeOnboardingAnchor.SlidesTemplatesPrompt}
				>
					<SlidesTemplatePromptDock
						selectedTemplate={selectedTemplate}
						onFindSimilarColors={onFindSimilarColors}
						onPreviewSelectedTemplate={onPreviewSelectedTemplate}
						onClearSelectedTemplate={onClearSelectedTemplate}
					/>
				</motion.div>
			</div>
		</div>
	)
}
