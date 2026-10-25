import type { ReactNode } from "react"
import { PageHeader } from "@magic-admin-v2/components/page-header"
import { Separator } from "@magic-admin-v2/components/ui/separator"
import { cn } from "@magic-admin-v2/utils/cn"

export function ListShell({
	actions,
	children,
	className,
	contentClassName,
	contentHeader,
	description,
	headerContent,
	headerClassName,
	testId,
	showSeparator = true,
	title,
	titleAddon,
}: {
	actions?: ReactNode
	children: ReactNode
	className?: string
	contentClassName?: string
	contentHeader?: ReactNode
	description?: string
	headerContent?: ReactNode
	headerClassName?: string
	testId?: string
	showSeparator?: boolean
	title: string
	titleAddon?: ReactNode
}) {
	return (
		<div
			className={cn("-m-4 flex h-[calc(100svh-4rem)] min-h-0 flex-col", className)}
			data-testid={testId}
		>
			<div className={cn("shrink-0 px-4 pt-6 lg:px-6", headerClassName)}>
				{headerContent ? <div className="mb-3">{headerContent}</div> : null}
				<PageHeader
					title={title}
					titleAddon={titleAddon}
					description={description}
					actions={actions}
				/>
				{showSeparator ? <Separator className="my-4 lg:my-6" /> : null}
				{contentHeader ? <div className="pb-4">{contentHeader}</div> : null}
			</div>
			{/* Keep page content from creating a viewport-level x-axis scrollbar; nested tables own any local horizontal scrolling. */}
			<div className="dashboard-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-6 lg:px-6">
				<div className={cn(showSeparator ? "" : "mt-6", contentClassName)}>{children}</div>
			</div>
		</div>
	)
}
