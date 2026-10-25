import { Card, CardContent } from "@magic-admin-v2/components/ui/card"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"

export function CapabilityListSkeleton({ testId }: { testId?: string }) {
	return (
		<div className="space-y-4" data-testid={testId}>
			<div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-end">
				<div className="min-w-0 flex-1 space-y-1.5 md:w-[340px] xl:w-[420px]">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-9 w-full" />
				</div>
				<div className="w-full space-y-1.5 md:w-40">
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
			<div className="space-y-3">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 6 }).map((_, index) => (
						<Card className="h-full overflow-hidden border-border/50 py-0" key={index}>
							<CardContent className="flex h-full flex-col gap-4 p-4">
								<div className="flex items-start gap-3">
									<Skeleton className="size-10 rounded-md" />
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-5 w-32" />
										<Skeleton className="h-4 w-32" />
									</div>
								</div>
								<div className="space-y-2">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-3/4" />
								</div>
								<div className="mt-auto flex items-center justify-between border-t pt-4">
									<Skeleton className="h-6 w-20 rounded-full" />
									<Skeleton className="h-8 w-24" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
				<Skeleton className="h-4 w-24" />
			</div>
		</div>
	)
}
