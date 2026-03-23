import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/lib/utils"

export function HtmlCodeBlockPreviewSkeleton() {
	return (
		<div
			className="absolute inset-0 z-10 flex min-w-full flex-col gap-3 bg-background/95 p-3 backdrop-blur-sm"
			data-testid="html-code-block-preview-skeleton"
		>
			<div className="flex items-center justify-between rounded-[10px] border border-border/60 bg-card/90 px-3 py-2 shadow-xs">
				<div className="flex items-center gap-1.5">
					<span className={cn("size-2 rounded-full", "bg-[#FF5F57]")} />
					<span className={cn("size-2 rounded-full", "bg-[#FEBC2E]")} />
					<span className={cn("size-2 rounded-full", "bg-[#28C840]")} />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-3 w-24 rounded-full bg-muted [animation-duration:1.8s]" />
					<Skeleton className="h-3 w-16 rounded-full bg-muted [animation-duration:1.8s]" />
				</div>
			</div>
			<div className="flex flex-col gap-3 rounded-[18px] border border-border/60 bg-card/85 p-4 shadow-xs">
				<div className="flex items-center justify-between gap-3">
					<Skeleton className="h-4 w-40 rounded-full bg-muted [animation-duration:1.8s]" />
					<Skeleton className="h-4 w-20 rounded-full bg-muted [animation-duration:1.8s]" />
				</div>
				<Skeleton className="h-32 w-full rounded-2xl bg-muted [animation-duration:1.8s]" />
				<Skeleton className="h-4 w-3/4 rounded-full bg-muted [animation-duration:1.8s]" />
				<Skeleton className="h-4 w-1/2 rounded-full bg-muted [animation-duration:1.8s]" />
			</div>
			<div className="grid grid-cols-3 gap-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div
						key={index}
						className="flex flex-col gap-3 rounded-[14px] border border-border/60 bg-card/85 p-3 shadow-xs"
					>
						<Skeleton className="h-20 w-full rounded-xl bg-muted [animation-duration:1.8s]" />
						<Skeleton className="h-3 w-4/5 rounded-full bg-muted [animation-duration:1.8s]" />
						<Skeleton className="h-3 w-3/5 rounded-full bg-muted [animation-duration:1.8s]" />
					</div>
				))}
			</div>
		</div>
	)
}
