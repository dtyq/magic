import * as React from "react"
import { cn } from "@magic-admin-v2/utils/cn"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const textSelectionInputTypes = new Set(["text", "search", "url", "tel", "email", "password"])

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, onFocus, ...props }, ref) => {
		const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
			onFocus?.(event)

			if (!textSelectionInputTypes.has(type ?? "text")) return

			const input = event.currentTarget
			window.requestAnimationFrame(() => {
				const cursorPosition = input.value.length
				input.setSelectionRange(cursorPosition, cursorPosition)
			})
		}

		return (
			<input
				ref={ref}
				type={type}
				className={cn(
					"flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				onFocus={handleFocus}
				onWheel={(event) => event.currentTarget.blur()}
				{...props}
			/>
		)
	},
)

export { Input }
