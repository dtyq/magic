import { cn } from "@/lib/utils"
import { cloneElement, isValidElement, memo, type ReactElement, type ReactNode } from "react"

interface AnimatedIconProps {
	animationDirection?: "enter" | "exit"
	enableSound?: boolean
}

interface ConversationEmptyStateProps {
	className?: string
	icon: ReactNode
	title: ReactNode
	subtitle?: ReactNode
	variant?: "compact" | "hero"
	testId?: string
	iconAnimationDirection?: "enter" | "exit"
	iconSoundEnabled?: boolean
}

function ConversationEmptyState({
	className,
	icon,
	title,
	subtitle,
	variant = "compact",
	testId,
	iconAnimationDirection,
	iconSoundEnabled,
}: ConversationEmptyStateProps) {
	const isHero = variant === "hero"
	const renderedIcon =
		isValidElement(icon) && (iconAnimationDirection || iconSoundEnabled !== undefined)
			? cloneElement(icon as ReactElement<AnimatedIconProps>, {
					animationDirection: iconAnimationDirection,
					enableSound: iconSoundEnabled,
				})
			: icon

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center",
				isHero ? "gap-6" : "h-full flex-1 gap-4",
				className,
			)}
			data-testid={testId}
		>
			<div className="relative flex items-center justify-center text-sidebar-foreground">
				{renderedIcon}
			</div>
			<div className="flex flex-col items-center gap-2 text-center">
				<div
					className={cn(
						"font-['Poppins'] leading-none text-foreground",
						isHero ? "text-4xl" : "text-[20px]",
					)}
				>
					{title}
				</div>
				{subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
			</div>
		</div>
	)
}

export default memo(ConversationEmptyState)
