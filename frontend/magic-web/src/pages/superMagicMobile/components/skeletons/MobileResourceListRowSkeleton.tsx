import { Skeleton } from "@/components/shadcn-ui/skeleton"

/**
 * Generic mobile list row skeleton aligned with h-16 resource rows (chats, workspaces, recycle bin).
 */
function MobileResourceListRowSkeleton() {
	return (
		<div
			className="flex h-16 w-full shrink-0 items-center gap-2 rounded-lg px-3 py-[10px]"
			data-testid="mobile-resource-list-row-skeleton"
		>
			<Skeleton className="size-9 shrink-0 rounded-[10px]" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
				<Skeleton className="h-5 w-[65%] max-w-full rounded-md" />
				<Skeleton className="h-3.5 w-[40%] max-w-full rounded-md" />
			</div>
			<Skeleton className="size-4 shrink-0 rounded-sm" />
		</div>
	)
}

export default MobileResourceListRowSkeleton
