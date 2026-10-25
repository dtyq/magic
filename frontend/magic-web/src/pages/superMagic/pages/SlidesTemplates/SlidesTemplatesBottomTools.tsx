import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { RefObject } from "react"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import SlidesTemplatesPromptRegion from "./SlidesTemplatesPromptRegion"
import SlidesTemplatesToolbar, { type SlidesTemplatesToolbarProps } from "./SlidesTemplatesToolbar"

interface SlidesTemplatesBottomToolsProps {
	bottomOffset: number
	containerRef: RefObject<HTMLDivElement | null>
	isInlinePreviewOpen: boolean
	selectedTemplate: OptionItem | null
	onClearSelectedTemplate: () => void
	onFindSimilarColors?: (template: OptionItem) => void
	onPreviewSelectedTemplate: () => void
	toolbarProps: SlidesTemplatesToolbarProps
}

export default function SlidesTemplatesBottomTools({
	bottomOffset,
	containerRef,
	isInlinePreviewOpen,
	selectedTemplate,
	onClearSelectedTemplate,
	onFindSimilarColors,
	onPreviewSelectedTemplate,
	toolbarProps,
}: SlidesTemplatesBottomToolsProps) {
	const reduceMotion = useReducedMotion()

	return (
		<AnimatePresence initial={false}>
			{isInlinePreviewOpen ? null : (
				<motion.div
					ref={containerRef}
					key="bottom-tools-shell"
					initial={reduceMotion ? false : { opacity: 0, y: 42, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 42, scale: 0.98 }}
					transition={
						reduceMotion
							? { duration: 0 }
							: { type: "spring", stiffness: 420, damping: 38, mass: 0.7 }
					}
					className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6"
					style={{ bottom: bottomOffset }}
				>
					<motion.div
						className="pointer-events-auto flex w-full max-w-3xl flex-col rounded-2xl bg-zinc-950/[0.42] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
						data-testid="slides-templates-page-bottom-tools"
					>
						<SlidesTemplatesPromptRegion
							selectedTemplate={selectedTemplate}
							onFindSimilarColors={onFindSimilarColors}
							onPreviewSelectedTemplate={onPreviewSelectedTemplate}
							onClearSelectedTemplate={onClearSelectedTemplate}
						/>
						<SlidesTemplatesToolbar
							{...toolbarProps}
							className={selectedTemplate ? "mt-2.5" : undefined}
						/>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
