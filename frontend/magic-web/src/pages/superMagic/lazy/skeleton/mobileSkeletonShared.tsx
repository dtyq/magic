import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/lib/utils"
import TopicItemSkeleton from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/components/TopicItemSkeleton"

type MobileHeaderSkeletonVariant = "project-entry" | "project-topic" | "chat-hero" | "mobile-home"

interface MobileHeaderSkeletonProps {
	variant: MobileHeaderSkeletonVariant
	className?: string
}

/** Shell header placeholder aligned with ProjectDetailHeader / ChatProjectHeroHeader. */
function MobileHeaderSkeleton({ variant, className }: MobileHeaderSkeletonProps) {
	return (
		<div
			className={cn("mobile-page-header pb-0", className)}
			data-testid={`mobile-header-skeleton-${variant}`}
		>
			<Skeleton className="size-12 shrink-0 rounded-full" />
			<div className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-[114px] text-center">
				<Skeleton className="h-6 w-[58%] max-w-[200px] rounded-md" />
				{variant === "chat-hero" ? (
					<Skeleton className="mt-1 h-4 w-[32%] max-w-[120px] rounded-md" />
				) : null}
			</div>
			{variant === "project-entry" ? (
				<div className="ml-auto flex h-12 shrink-0 overflow-hidden rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]">
					<Skeleton className="size-12 rounded-none" />
					<Skeleton className="size-12 rounded-none" />
				</div>
			) : null}
			{variant === "project-topic" || variant === "chat-hero" || variant === "mobile-home" ? (
				<Skeleton className="ml-auto size-12 shrink-0 rounded-full" />
			) : null}
		</div>
	)
}

/** Bottom composer dock; toolbar icons share the same skeleton style (no send-button emphasis). */
function MobileComposerFooterSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn("flex w-full shrink-0 flex-col gap-2 px-3 pb-1", className)}
			data-testid="mobile-composer-footer-skeleton"
		>
			<div className="flex w-full flex-col gap-2 rounded-2xl border bg-card p-2.5 shadow-xs">
				<Skeleton className="h-8 w-full rounded-md" />
				<div className="flex w-full items-center justify-between">
					<div className="flex items-center gap-1">
						<Skeleton className="size-8 rounded-md" />
						<Skeleton className="size-8 rounded-md" />
					</div>
					<div className="flex items-center gap-1">
						<Skeleton className="size-8 rounded-md" />
						<Skeleton className="size-8 rounded-md" />
					</div>
				</div>
			</div>
		</div>
	)
}

/** Chat message bubbles; extra top padding separates the first bubble from the header. */
function MobileMessageBubblesSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-3 pt-5",
				className,
			)}
			data-testid="mobile-message-bubbles-skeleton"
		>
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
	)
}

interface MobileConversationPageSkeletonProps {
	showHeader?: boolean
	headerVariant?: MobileHeaderSkeletonVariant
	className?: string
}

/** Brand hero placeholder aligned with MobileBrandHero on mobile-home. */
function MobileBrandHeroSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex w-full max-w-[348px] shrink-0 flex-col items-center gap-3 text-center",
				className,
			)}
			data-testid="mobile-brand-hero-skeleton"
		>
			<Skeleton className="size-20 shrink-0 rounded-full" />
			<Skeleton className="h-4 w-[180px] max-w-full rounded-md" />
			<Skeleton className="h-7 w-[240px] max-w-full rounded-md" />
		</div>
	)
}

/** Mobile-home skeleton: shared header/composer pattern from conversation detail + centered hero. */
export function MobileHomePageSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 flex-col overflow-hidden bg-mobile-background",
				className,
			)}
			data-testid="mobile-home-page-skeleton"
		>
			<MobileHeaderSkeleton variant="mobile-home" />
			<div className="flex min-h-0 flex-1 items-center justify-center px-4">
				<MobileBrandHeroSkeleton />
			</div>
			<MobileComposerFooterSkeleton />
		</div>
	)
}

/** Conversation page skeleton shared by topic and chat routes. */
export function MobileConversationPageSkeleton({
	showHeader = false,
	headerVariant = "chat-hero",
	className,
}: MobileConversationPageSkeletonProps) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 flex-col overflow-hidden bg-mobile-background",
				className,
			)}
			data-testid="mobile-conversation-page-skeleton"
		>
			{showHeader ? <MobileHeaderSkeleton variant={headerVariant} /> : null}
			{/* Match ChatProjectMessagePanel: one mobile-background surface under the transparent header. */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<MobileMessageBubblesSkeleton />
			</div>
			<MobileComposerFooterSkeleton />
		</div>
	)
}

/** Project entry body: tabs + topic rows + composer (header from shell). */
export function MobileProjectEntrySkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 flex-col overflow-hidden bg-mobile-background",
				className,
			)}
			data-testid="mobile-project-entry-skeleton"
		>
			<div className="flex shrink-0 justify-start px-3 pt-4">
				<div className="flex h-9 w-max max-w-full items-center rounded-full bg-muted p-[3px]">
					<Skeleton className="h-[30px] w-16 rounded-full" />
					<Skeleton className="ml-1 h-[30px] w-16 rounded-full" />
				</div>
			</div>
			<div
				className="relative min-h-0 flex-1 overflow-hidden px-3 pb-2"
				data-testid="mobile-topic-list-skeleton"
			>
				{Array.from({ length: 4 }).map((_, index) => (
					<TopicItemSkeleton key={index} />
				))}
			</div>
			<MobileComposerFooterSkeleton />
		</div>
	)
}

export { MobileHeaderSkeleton }
