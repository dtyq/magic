import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Home } from "lucide-react"

export interface MobilePathBreadcrumbSegment {
	key: string
	label: string
	onClick: () => void
	testId?: string
}

interface MobilePathBreadcrumbProps {
	segments: MobilePathBreadcrumbSegment[]
	canBack: boolean
	onBack: () => void
	onGoHome: () => void
	backLabel: string
	homeLabel: string
	className?: string
	backButtonClassName?: string
	homeButtonClassName?: string
	dividerClassName?: string
	backIconClassName?: string
	homeIconClassName?: string
	scrollClassName?: string
	scrollTestId?: string
	contentClassName?: string
	separatorClassName?: string
	segmentButtonClassName?: string
	activeSegmentClassName?: string
	inactiveSegmentClassName?: string
	backButtonTestId?: string
	homeButtonTestId?: string
}

/**
 * Shared mobile breadcrumb shell for file browsing surfaces.
 * The callers keep control over segment data and fine-grained spacing, while
 * the back/home affordances and horizontal scrolling stay behaviorally aligned.
 */
export default function MobilePathBreadcrumb({
	segments,
	canBack,
	onBack,
	onGoHome,
	backLabel,
	homeLabel,
	className,
	backButtonClassName,
	homeButtonClassName,
	dividerClassName,
	backIconClassName,
	homeIconClassName,
	scrollClassName,
	scrollTestId,
	contentClassName,
	separatorClassName,
	segmentButtonClassName,
	activeSegmentClassName,
	inactiveSegmentClassName,
	backButtonTestId,
	homeButtonTestId,
}: MobilePathBreadcrumbProps) {
	return (
		<div
			className={cn("flex shrink-0 items-center gap-1 overflow-hidden", className)}
		>
			<button
				type="button"
				disabled={!canBack}
				onClick={onBack}
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-foreground/[0.06] disabled:opacity-30",
					backButtonClassName,
				)}
				data-testid={backButtonTestId}
				aria-label={backLabel}
			>
				<ChevronLeft className={cn("size-5", backIconClassName)} />
			</button>
			<div className={cn("mx-1 h-4 w-px shrink-0 bg-border", dividerClassName)} />
			<button
				type="button"
				onClick={onGoHome}
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/[0.06]",
					homeButtonClassName,
				)}
				data-testid={homeButtonTestId}
				aria-label={homeLabel}
			>
				<Home className={cn("size-[18px]", homeIconClassName)} />
			</button>
			<div
				className={cn(
					"no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden",
					scrollClassName,
				)}
				data-testid={scrollTestId}
			>
				<div className={cn("flex min-w-max items-center pr-2", contentClassName)}>
					{segments.map((segment, index) => (
						<div key={segment.key} className="flex shrink-0 items-center">
							<ChevronRight
								className={cn(
									"size-4 shrink-0 text-muted-foreground/50",
									separatorClassName,
								)}
							/>
							<button
								type="button"
								onClick={segment.onClick}
								className={cn(
									"max-w-[168px] shrink-0 truncate rounded-lg px-1.5 py-1 text-left text-[15px] leading-5",
									segmentButtonClassName,
									index === segments.length - 1
										? cn("font-medium text-foreground", activeSegmentClassName)
										: cn(
											"text-muted-foreground active:bg-foreground/[0.05]",
											inactiveSegmentClassName,
									  ),
								)}
								data-testid={segment.testId}
							>
								{segment.label}
							</button>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}