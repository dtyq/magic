import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { Button } from "@/components/shadcn-ui/button"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { cn } from "@/lib/utils"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"
import { isImageIconSource } from "../utils"

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
					const isImageIcon = isImageIconSource(template.icon_url)
					const label = lt(template.label) ?? template.value

					return (
						<motion.div key={template.value} variants={itemVariants}>
							<Button
								variant="outline"
								className={cn(
									"h-9 gap-2 rounded-full border border-border px-4 py-2 shadow-xs transition-[border-color]",
									isSelected && "border-2 border-primary",
								)}
								onClick={() => onTemplateClick?.(template)}
							>
								{template.icon_url &&
									(isImageIcon ? (
										<img
											src={template.icon_url}
											alt={label}
											width={24}
											height={24}
											className="shrink-0 object-contain"
											loading="lazy"
										/>
									) : (
										<LucideLazyIcon icon={template.icon_url} size={24} />
									))}
								<span className="text-sm font-medium leading-5">{label}</span>
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
