import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { LucideLazyIcon } from "@/opensource/utils/lucideIconLoader"
import { cn } from "@/opensource/lib/utils"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"

interface TemplateCapsuleProps {
	selectedTemplate?: OptionItem
	templates: OptionItem[]
	onTemplateClick?: (template: OptionItem) => void
	className?: string
}

// Stagger animation for capsule items
const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.05,
			delayChildren: 0.05,
		},
	},
}

const itemVariants = {
	hidden: { opacity: 0, scale: 0.9 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: {
			type: "spring" as const,
			stiffness: 300,
			damping: 25,
		},
	},
}

/**
 * Capsule layout component for templates
 * Implements button-style cards in horizontal flow layout from Figma design
 */
const TemplateCapsule = observer(
	({ selectedTemplate, templates, onTemplateClick, className }: TemplateCapsuleProps) => {
		const lt = useLocaleText()
		return (
			<motion.div
				className={cn("flex w-full flex-wrap content-start items-start gap-2", className)}
				variants={containerVariants}
				initial="hidden"
				animate="visible"
			>
				{templates.map((template) => {
					const isSelected = selectedTemplate?.value === template.value

					return (
						<motion.div key={template.value} variants={itemVariants}>
							<Button
								variant="outline"
								className={cn(
									"shadow-xs h-9 gap-2 rounded-full border border-border px-4 py-2 transition-[border-color]",
									isSelected && "border-2 border-primary",
								)}
								onClick={() => onTemplateClick?.(template)}
							>
								{template.icon_url && (
									<LucideLazyIcon icon={template.icon_url} size={24} />
								)}
								<span className="text-sm font-medium leading-5">
									{lt(template.label) ?? template.value}
								</span>
							</Button>
						</motion.div>
					)
				})}
			</motion.div>
		)
	},
)

TemplateCapsule.displayName = "TemplateCapsule"

export default TemplateCapsule
