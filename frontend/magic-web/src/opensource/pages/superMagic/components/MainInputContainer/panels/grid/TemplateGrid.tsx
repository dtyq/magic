import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import TemplateCard from "./TemplateCard"
import type { OptionItem } from "../types"
import { cn } from "@/opensource/lib/utils"

interface TemplateGridProps {
	selectedTemplate?: OptionItem
	templates: OptionItem[]
	onTemplateClick?: (template: OptionItem) => void
	className?: string
}

// Stagger animation for grid items
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
		scale: 0.7,
	},
	visible: {
		opacity: 1,
		scale: 1,
		transition: {
			type: "spring" as const,
			stiffness: 260,
			damping: 25,
			duration: 0.5,
		},
	},
}

const TemplateGrid = observer(
	({ selectedTemplate, templates, onTemplateClick, className }: TemplateGridProps) => {
		return (
			<motion.div
				className={cn(
					"scrollbar-hide grid w-full grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]",
					className,
				)}
				variants={containerVariants}
				initial="hidden"
				animate="visible"
			>
				{templates.map((template) => (
					<motion.div key={template.value} variants={itemVariants}>
						<TemplateCard
							template={template}
							isSelected={selectedTemplate?.value === template.value}
							onClick={onTemplateClick}
						/>
					</motion.div>
				))}
			</motion.div>
		)
	},
)

TemplateGrid.displayName = "TemplateGrid"

export default TemplateGrid
