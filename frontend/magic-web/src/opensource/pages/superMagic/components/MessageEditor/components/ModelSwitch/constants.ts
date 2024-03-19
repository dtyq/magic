import { cva } from "class-variance-authority"
import type { MessageEditorSize } from "../../types"

// Size variant definitions using CVA
export const modelSwitchVariants = cva(
	"inline-flex cursor-pointer items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md transition-all duration-200 hover:bg-secondary/80",
	{
		variants: {
			size: {
				small: "h-6 px-1.5 py-1 text-xs",
				default: "h-8 px-2 py-1 text-xs",
				mobile: "h-7 px-2 py-1 text-xs",
			},
			variant: {
				secondary: "bg-secondary text-secondary-foreground",
			},
		},
		defaultVariants: {
			size: "default",
			variant: "secondary",
		},
	},
)

// Icon size mapping based on size variant
export const ICON_SIZE_MAP: Record<MessageEditorSize, number> = {
	small: 16,
	default: 16,
	mobile: 16,
}

export const CHEVRON_SIZE_MAP: Record<MessageEditorSize, number> = {
	small: 16,
	default: 16,
	mobile: 16,
}
