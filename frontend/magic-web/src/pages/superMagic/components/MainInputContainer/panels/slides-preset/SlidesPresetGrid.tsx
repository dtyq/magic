import { useState } from "react"
import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { OptionItem } from "../types"
import { localeTextToDisplayString } from "../utils"
import SlidesPresetCard from "./SlidesPresetCard"
import SlidesPresetPreviewDialog from "./SlidesPresetPreviewDialog"

interface SlidesPresetGridProps {
	selectedTemplate?: OptionItem
	templates: OptionItem[]
	onTemplateClick?: (template: OptionItem) => void
	className?: string
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.1,
		},
	},
}

const itemVariants = {
	hidden: {
		opacity: 0,
		y: 40,
		scale: 0.85,
		rotateX: 10,
	},
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		rotateX: 0,
		transition: {
			type: "spring" as const,
			stiffness: 280,
			damping: 20,
			mass: 0.8,
			duration: 0.5,
		},
	},
}

const SlidesPresetGrid = observer(
	({ selectedTemplate, templates, onTemplateClick, className }: SlidesPresetGridProps) => {
		const [previewTemplate, setPreviewTemplate] = useState<OptionItem | null>(null)
		const [preloadedPreviewTemplate, setPreloadedPreviewTemplate] = useState<OptionItem | null>(
			null,
		)

		function handlePreviewOpenChange(open: boolean) {
			if (open) return
			setPreviewTemplate(null)
		}

		function handlePreviewPreload(template: OptionItem) {
			if (!template.preview_url) return
			setPreloadedPreviewTemplate(template)
		}

		const preloadedPreviewUrl = preloadedPreviewTemplate?.preview_url
		const openedPreviewUrl = previewTemplate?.preview_url

		return (
			<>
				<motion.div
					data-testid="slides-preset-grid"
					className={cn(
						"scrollbar-hide grid w-full grid-cols-2 content-start gap-4 overflow-y-auto overflow-x-hidden p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
						className,
					)}
					variants={containerVariants}
					initial="hidden"
					animate="visible"
				>
					{templates.map((template) => {
						const value = localeTextToDisplayString(template.value)

						return (
							<motion.div
								key={value}
								variants={itemVariants}
								whileInView="visible"
								initial="hidden"
								viewport={{ once: true, amount: 0.1 }}
								whileHover={{ scale: 1.15, y: -6, zIndex: 40 }}
								transition={{ type: "spring", stiffness: 300, damping: 20 }}
								className="relative flex size-full will-change-transform"
							>
								<SlidesPresetCard
									template={template}
									isSelected={
										localeTextToDisplayString(selectedTemplate?.value) === value
									}
									onClick={onTemplateClick}
									onPreviewClick={setPreviewTemplate}
									onPreviewPreload={handlePreviewPreload}
								/>
							</motion.div>
						)
					})}
				</motion.div>
				{preloadedPreviewUrl && preloadedPreviewUrl !== openedPreviewUrl ? (
					<iframe
						data-testid="slides-preset-preview-preload-iframe"
						title="Preload slide preset preview"
						src={preloadedPreviewUrl}
						className="pointer-events-none fixed size-px opacity-0"
						aria-hidden="true"
						tabIndex={-1}
						referrerPolicy="no-referrer"
						sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
					/>
				) : null}
				<SlidesPresetPreviewDialog
					template={previewTemplate}
					open={Boolean(previewTemplate)}
					onOpenChange={handlePreviewOpenChange}
					onSelect={onTemplateClick}
				/>
			</>
		)
	},
)

SlidesPresetGrid.displayName = "SlidesPresetGrid"

export default SlidesPresetGrid
