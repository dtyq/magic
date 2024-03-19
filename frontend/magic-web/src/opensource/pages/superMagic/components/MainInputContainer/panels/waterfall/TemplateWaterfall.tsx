import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import { motion } from "framer-motion"
import WaterfallCard from "./WaterfallCard"
import { useWaterfallColumns } from "./useWaterfallColumns"
import type { OptionItem } from "../types"
import { localeTextToDisplayString } from "../utils"
import { cn } from "@/opensource/lib/utils"

interface TemplateWaterfallProps {
	selectedTemplate?: OptionItem
	templates: OptionItem[]
	onTemplateClick?: (template: OptionItem) => void
	/** Maximum number of columns; actual count adapts to container width. */
	maxColumns?: number
	className?: string
}

/**
 * Waterfall layout component for templates.
 * Column count adapts to container width (up to maxColumns).
 */
const TemplateWaterfall = observer(
	({
		selectedTemplate,
		templates,
		onTemplateClick,
		maxColumns = 3,
		className,
	}: TemplateWaterfallProps) => {
		const { containerRef, columns } = useWaterfallColumns(maxColumns)
		const selectedTemplateKey = selectedTemplate
			? localeTextToDisplayString(selectedTemplate.value)
			: ""

		const columnTemplates = useMemo(() => {
			const cols: OptionItem[][] = Array.from({ length: columns }, () => [])

			templates.forEach((template, index) => {
				const columnIndex = index % columns
				cols[columnIndex].push(template)
			})

			return cols
		}, [templates, columns])

		return (
			<div ref={containerRef} className={cn("flex w-full items-start gap-2", className)}>
				{columnTemplates.map((columnItems, columnIndex) => (
					<motion.div
						key={columnIndex}
						className="flex flex-1 flex-col gap-2"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{
							duration: 0.3,
							delay: columnIndex * 0.08,
							ease: [0.4, 0, 0.2, 1],
						}}
					>
						{columnItems.map((template, itemIndex) => {
							const templateKey = localeTextToDisplayString(template.value)

							return (
								<motion.div
									key={templateKey || `${columnIndex}-${itemIndex}`}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{
										duration: 0.25,
										delay: columnIndex * 0.08 + itemIndex * 0.04,
										ease: [0.4, 0, 0.2, 1],
									}}
								>
									<WaterfallCard
										template={template}
										isSelected={selectedTemplateKey === templateKey}
										onClick={onTemplateClick}
									/>
								</motion.div>
							)
						})}
					</motion.div>
				))}
			</div>
		)
	},
)

TemplateWaterfall.displayName = "TemplateWaterfall"

export default TemplateWaterfall
