import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/lib/tiptap-utils"

/**
 * 项目详情移动端骨架：对齐新的“项目详情首页”结构，避免刷新时闪出旧文件页。
 */
export default function ProjectPageMobileSkeleton() {
	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			<div className="flex min-h-0 flex-1 flex-col px-3 pt-3">
				<div className="mb-3 flex h-[52px] items-center gap-3">
					<Skeleton className="size-10 rounded-full" />
					<Skeleton className="h-6 flex-1 rounded-full" />
					<Skeleton className="h-10 w-20 rounded-full" />
				</div>
				<div className="bg-white/72 mb-3 inline-flex w-fit rounded-full p-1 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
					<Skeleton className="h-9 w-16 rounded-full" />
					<Skeleton className="ml-1 h-9 w-16 rounded-full" />
				</div>
				<div className="bg-white/78 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] px-3 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-[72px] w-full rounded-2xl" />
						<Skeleton className="h-[72px] w-full rounded-2xl" />
						<Skeleton className="h-[72px] w-full rounded-2xl" />
						<Skeleton className="h-[72px] w-full rounded-2xl" />
					</div>
				</div>
			</div>
			<div
				className={cn(
					"flex shrink-0 flex-col items-start justify-end gap-1.5 bg-white px-3 pb-3",
					`pb-safe-bottom`,
				)}
			>
				<div className="flex w-full items-start gap-2">
					<Skeleton className="h-7 w-24 rounded-full" />
					<Skeleton className="h-7 w-24 rounded-full" />
				</div>
				<div className="flex w-full flex-col items-start gap-2 rounded-[24px] border bg-white p-3 shadow-xs">
					<Skeleton className="h-8 w-full rounded-md" />
					<div className="flex w-full items-start justify-between">
						<div className="flex items-center gap-1">
							<Skeleton className="size-8 rounded-md" />
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
