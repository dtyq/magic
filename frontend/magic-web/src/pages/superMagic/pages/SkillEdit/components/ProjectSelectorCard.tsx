import { ArrowLeft, Pencil } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"

interface ProjectSelectorCardProps {
	projectName: string
	coverLabel: string
	skillLogo?: string
	onBack: () => void
}

function ProjectSelectorCard({
	projectName,
	coverLabel,
	skillLogo,
	onBack,
}: ProjectSelectorCardProps) {
	return (
		<div
			className="flex items-start justify-center gap-1"
			data-testid="skill-edit-project-card"
		>
			<Button
				type="button"
				variant="outline"
				size="icon"
				className="size-10 shrink-0 rounded-lg bg-background"
				onClick={onBack}
				data-testid="skill-edit-back-button"
			>
				<ArrowLeft className="size-4" />
			</Button>

			<button
				type="button"
				className="flex h-10 min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-background px-2 py-1.5 text-left"
				data-testid="skill-edit-project-selector"
			>
				<div className="relative size-7 shrink-0 overflow-hidden rounded-md bg-[linear-gradient(135deg,#111827_0%,#4f46e5_100%)]">
					{skillLogo ? (
						<img src={skillLogo} alt={projectName} className="size-full object-cover" />
					) : (
						<div className="flex size-full items-center justify-center text-xs font-semibold text-white">
							{coverLabel}
						</div>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium leading-5 text-sidebar-foreground">
						{projectName}
					</p>
				</div>
				<Pencil className="size-4 shrink-0 text-muted-foreground" />
			</button>
		</div>
	)
}

export default ProjectSelectorCard
