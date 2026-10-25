import { ChevronRight } from "lucide-react"
import { cn } from "@/utils/cn"
import { FileResourceIcon } from "./FileResourceIcon"
import type { FilePresentation } from "../utils/file-presentation"

interface ExampleProps {
	mode: "example"
	presentation: FilePresentation
	depth: number
	expanded: boolean
	onExpand: () => void
	description?: string
}

export function FileDirectoryRow({
	presentation,
	depth,
	expanded,
	onExpand,
	description,
}: ExampleProps) {
	const { name, isDirectory } = presentation
	return (
		<div className="group relative flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 hover:bg-accent">
			<div
				data-file-label-row
				className="flex min-w-0 flex-1 items-center gap-2 py-1"
				style={{ paddingInlineStart: depth * 20 }}
			>
				{isDirectory ? (
					<button
						type="button"
						className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={name}
						aria-expanded={expanded}
						onClick={onExpand}
					>
						<ChevronRight
							size={14}
							className={cn(
								"transition-transform motion-reduce:transition-none",
								expanded && "rotate-90",
							)}
						/>
					</button>
				) : (
					<span className="size-5 shrink-0" />
				)}
				<div
					data-file-name-container
					className="flex min-w-0 flex-1 items-center gap-2 text-xs"
					title={name}
				>
					<FileResourceIcon presentation={presentation} size={16} />
					<span data-file-name className="min-w-0 max-w-full truncate">
						{name}
					</span>
				</div>
				<span className="min-w-0 flex-1 text-xs text-muted-foreground">{description}</span>
			</div>
		</div>
	)
}
