import { LayoutTemplate } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"

interface EmptyStateProps {
	title: string
	description: string
	createLabel: string
	onCreate: () => void
}

export function EmptyState({ title, description, createLabel, onCreate }: EmptyStateProps) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center px-3">
			<div className="flex w-full flex-col items-center gap-6 rounded-lg border border-dashed border-border p-6">
				<div className="shadow-xs flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card">
					<LayoutTemplate className="h-6 w-6 text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center gap-2 text-center">
					<p className="text-xl font-semibold text-foreground">{title}</p>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				<Button onClick={onCreate} data-testid="scene-panel-empty-create">
					{createLabel}
				</Button>
			</div>
		</div>
	)
}
