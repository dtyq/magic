import type { ReactNode } from "react"

type PageHeaderProps = {
	title: string
	titleAddon?: ReactNode
	description?: string
	actions?: ReactNode
	testId?: string
}

type PageHeaderActionsProps = {
	children: ReactNode
}

/** Shared action slot for the page title area. Use PageHeaderActionButton for responsive buttons. */
export function PageHeaderActions({ children }: PageHeaderActionsProps) {
	return (
		<div
			className="flex w-auto min-w-0 shrink-0 flex-wrap items-center justify-end gap-2"
			data-slot="page-header-actions"
		>
			{children}
		</div>
	)
}

export function PageHeader({ title, titleAddon, description, actions, testId }: PageHeaderProps) {
	return (
		<div
			className="flex min-w-0 flex-row items-start justify-between gap-4"
			data-testid={testId}
		>
			<div className="min-w-0 flex-1 space-y-2">
				<div className="flex min-w-0 items-center gap-2">
					<h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
						{title}
					</h1>
					{titleAddon}
				</div>
				{description ? (
					<p className="max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{actions ? <PageHeaderActions>{actions}</PageHeaderActions> : null}
		</div>
	)
}
