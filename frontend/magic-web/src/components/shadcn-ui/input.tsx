import * as React from "react"

import { cn } from "@/utils/cn"

type InputProps = React.ComponentProps<"input"> & {
	/**
	 * Receives ordinary changes immediately and IME input once it has been confirmed.
	 * `onChange` keeps the native event behavior so existing consumers are unaffected.
	 */
	onValueChangeAfterComposition?: (value: string) => void
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	(
		{
			className,
			type,
			onChange,
			onCompositionStart,
			onCompositionEnd,
			onValueChangeAfterComposition,
			...props
		},
		ref,
	) => {
		const isComposingRef = React.useRef(false)

		return (
			<input
				ref={ref}
				type={type}
				data-slot="input"
				className={cn(
					"h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm",
					"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
					"aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
					"text-foreground",
					className,
				)}
				onChange={(event) => {
					onChange?.(event)
					if (!isComposingRef.current) onValueChangeAfterComposition?.(event.target.value)
				}}
				onCompositionStart={(event) => {
					isComposingRef.current = true
					onCompositionStart?.(event)
				}}
				onCompositionEnd={(event) => {
					isComposingRef.current = false
					onCompositionEnd?.(event)
					onValueChangeAfterComposition?.(event.currentTarget.value)
				}}
				{...props}
			/>
		)
	},
)
Input.displayName = "Input"

export { Input }
