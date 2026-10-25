import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@magic-admin-v2/utils/cn"

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
	checked?: boolean
	loading?: boolean
	onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
	({ checked = false, className, disabled, loading = false, onCheckedChange, ...props }, ref) => (
		<button
			ref={ref}
			type="button"
			role="switch"
			aria-checked={checked}
			aria-busy={loading || undefined}
			disabled={disabled || loading}
			className={cn(
				"inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				checked ? "bg-primary" : "bg-input",
				className,
			)}
			onClick={() => onCheckedChange?.(!checked)}
			{...props}
		>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none flex size-5 items-center justify-center rounded-full bg-background shadow transition-transform",
					checked ? "translate-x-5" : "translate-x-0",
				)}
			>
				{loading ? (
					<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
				) : null}
			</span>
		</button>
	),
)

export { Switch }
