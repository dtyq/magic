import { Skeleton } from "@/components/shadcn-ui/skeleton"

/**
 * Message editor loading skeleton matching ChatInputLarge design
 * Replicates the full input container layout with action buttons
 */
function MessageEditorSkeleton() {
	return (
		<div className="inset-0 mx-auto flex min-h-[150px] w-full items-end">
			{/* Input Container */}
			<div className="w-full rounded-[14px] border border-border bg-background p-[10px]">
				{/* Top Action Group */}
				<div className="mb-2 flex flex-wrap items-center gap-2">
					{/* @ Button */}
					<Skeleton className="size-6 shrink-0 rounded-lg" />
					{/* 1 Tab Button */}
					<Skeleton className="h-6 w-20 rounded-lg" />
				</div>

				{/* Text Container */}
				<div className="mb-2 min-h-[64px] space-y-0.5">
					{/* Placeholder text lines */}
					<Skeleton className="h-5 w-full max-w-[400px]" />
					{/* Helper text */}
					<div className="pt-1">
						<Skeleton className="h-5 w-64" />
					</div>
				</div>

				{/* Actions Container */}
				<div className="flex items-center justify-between">
					{/* Model Selector */}
					<Skeleton className="h-8 w-32 rounded-lg" />

					{/* Actions Bar */}
					<div className="flex items-center gap-2">
						{/* Primary Actions Group */}
						<div className="flex items-center gap-1">
							<Skeleton className="size-9 shrink-0 rounded-lg" />
							<Skeleton className="size-9 shrink-0 rounded-lg" />
						</div>

						{/* Divider */}
						<div className="h-4 w-px bg-border" />

						{/* Secondary Actions Group */}
						<div className="flex items-center gap-1">
							<Skeleton className="size-9 shrink-0 rounded-lg" />
							<Skeleton className="size-9 shrink-0 rounded-lg" />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default MessageEditorSkeleton
