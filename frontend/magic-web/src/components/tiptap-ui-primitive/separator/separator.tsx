import * as React from "react"
import "@/components/tiptap-ui-primitive/separator/separator.scss"
import { cn } from "@/lib/tiptap-utils"

export type Orientation = "horizontal" | "vertical"

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
	orientation?: Orientation
	decorative?: boolean
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
	({ decorative, orientation = "vertical", className, ...divProps }, ref) => {
		const ariaOrientation = orientation === "vertical" ? orientation : undefined
		const semanticProps = decorative
			? { role: "none" }
			: { "aria-orientation": ariaOrientation, role: "separator" }

		return (
			<div
				className={cn("tiptap-separator", className)}
				data-orientation={orientation}
				{...semanticProps}
				{...divProps}
				ref={ref}
			/>
		)
	},
)

Separator.displayName = "Separator"
