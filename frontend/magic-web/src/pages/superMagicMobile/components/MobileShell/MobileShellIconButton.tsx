import { cn } from "@/lib/utils"

interface MobileShellIconButtonProps {
	children: React.ReactNode
	label: string
	onClick: () => void
	testId: string
	className?: string
	disabled?: boolean
}

export default function MobileShellIconButton({
	children,
	label,
	onClick,
	testId,
	className,
	disabled = false,
}: MobileShellIconButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			aria-label={label}
			data-testid={testId}
			className={cn(
				"flex h-12 w-12 items-center justify-center rounded-full bg-background text-foreground shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
		>
			{children}
		</button>
	)
}
