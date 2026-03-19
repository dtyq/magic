import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"

interface TemplateTextListProps {
	selectedTemplate?: OptionItem
	templates: OptionItem[]
	onTemplateClick?: (template: OptionItem) => void
	className?: string
}

// Stagger animation for list items
const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.05,
			delayChildren: 0.1,
		},
	},
}

const itemVariants = {
	hidden: {
		opacity: 0,
		x: -20,
	},
	visible: {
		opacity: 1,
		x: 0,
		transition: {
			type: "spring" as const,
			stiffness: 300,
			damping: 30,
			duration: 0.4,
		},
	},
}

/**
 * Text list layout component for templates
 * Implements vertical list with button-style cards from Figma design
 */
const TemplateTextList = observer(
	({ templates, className, onTemplateClick }: TemplateTextListProps) => {
		const lt = useLocaleText()
		return (
			<motion.div
				className={cn("flex w-full flex-col gap-2", className)}
				variants={containerVariants}
				initial="hidden"
				animate="visible"
			>
				{templates.map((template) => {
					return (
						<motion.button
							key={template.value}
							type="button"
							variants={itemVariants}
							// onClick={() => onTemplateClick?.(template)}
							className={cn(
								"flex h-9 w-full items-center gap-2 rounded-md px-4 py-2 text-sm shadow-sm transition-colors",
								"bg-secondary text-secondary-foreground",
								"hover:bg-secondary/80",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							)}
							onClick={() => onTemplateClick?.(template)}
						>
							<span className="min-w-0 flex-1 truncate text-left leading-5">
								{lt(template.label) ?? lt(template.description) ?? template.value}
							</span>
							<ArrowUpRight className="size-4 shrink-0" />
						</motion.button>
					)
				})}
			</motion.div>
		)
	},
)

TemplateTextList.displayName = "TemplateTextList"

export default TemplateTextList
