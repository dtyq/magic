import type { ReactNode } from "react"

interface DesignStyleSectionHeaderProps {
	title: string
	description: string
	action?: ReactNode
	testId?: string
}

export default function DesignStyleSectionHeader({
	title,
	description,
	action,
	testId,
}: DesignStyleSectionHeaderProps) {
	// Each section title replaces the previous one at the scroll boundary instead of stacking.
	return (
		<div
			className="sticky top-0 z-10 -mx-1 -mt-2 flex flex-wrap items-center justify-between gap-2 bg-background/95 px-1 py-2 backdrop-blur-sm"
			data-testid={testId}
		>
			<div>
				<h4 className="text-sm font-semibold text-foreground">{title}</h4>
				<p className="text-xs leading-5 text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
	)
}
