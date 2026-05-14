import { Skeleton } from "@/components/shadcn-ui/skeleton"

export default function ChatProjectPageMobileSkeleton() {
	return (
		<div className="flex h-full flex-col bg-background">
			<div className="flex h-[calc(50px+var(--safe-area-inset-top))] items-center gap-2 border-b bg-background p-2.5 pt-[calc(0.65rem+var(--safe-area-inset-top))]">
				<Skeleton className="size-8 rounded-lg" />
				<Skeleton className="h-5 flex-1 rounded-md" />
				<div className="flex items-center gap-1">
					<Skeleton className="size-8 rounded-lg" />
					<Skeleton className="size-8 rounded-lg" />
					<Skeleton className="size-8 rounded-lg" />
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
				<div className="flex justify-start">
					<Skeleton className="h-20 w-[70%] rounded-2xl" />
				</div>
				<div className="flex justify-end">
					<Skeleton className="h-16 w-[62%] rounded-2xl" />
				</div>
				<div className="flex justify-start">
					<Skeleton className="h-24 w-[78%] rounded-2xl" />
				</div>
			</div>
			<div className="border-t bg-background p-2.5 pb-safe-bottom">
				<div className="flex flex-col gap-2 rounded-2xl border bg-white p-2.5 shadow-xs">
					<Skeleton className="h-8 w-full rounded-md" />
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-1">
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md" />
						</div>
						<div className="flex items-center gap-1">
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md bg-[var(--base/foreground,#0a0a0a)]" />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
