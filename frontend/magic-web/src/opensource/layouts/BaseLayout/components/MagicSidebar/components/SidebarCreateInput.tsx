import { Check, X } from "lucide-react"
import { useEffect, useRef } from "react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { cn } from "@/opensource/lib/utils"

type SidebarCreateInputSize = "sm" | "md"

interface SidebarCreateInputProps {
	value: string
	placeholder: string
	disabled?: boolean
	containerClassName?: string
	containerTestId?: string
	inputClassName?: string
	inputTestId: string
	submitButtonTestId: string
	cancelButtonTestId: string
	submitButtonAriaLabel: string
	cancelButtonAriaLabel: string
	size?: SidebarCreateInputSize
	stopKeyboardPropagation?: boolean
	onValueChange: (value: string) => void
	onSubmit: () => void | Promise<void>
	onCancel: () => void
}

const SIZE_CLASS_MAP: Record<SidebarCreateInputSize, string> = {
	sm: "h-8",
	md: "h-9",
}

function SidebarCreateInput({
	value,
	placeholder,
	disabled = false,
	containerClassName,
	containerTestId,
	inputClassName,
	inputTestId,
	submitButtonTestId,
	cancelButtonTestId,
	submitButtonAriaLabel,
	cancelButtonAriaLabel,
	size = "sm",
	stopKeyboardPropagation = false,
	onValueChange,
	onSubmit,
	onCancel,
}: SidebarCreateInputProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const wrapperRef = useRef<HTMLDivElement>(null)
	const hasValue = Boolean(value.trim())

	useEffect(() => {
		const timer = setTimeout(() => {
			inputRef.current?.focus()
			inputRef.current?.select()
		}, 50)

		return () => clearTimeout(timer)
	}, [])

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault()
			if (stopKeyboardPropagation) {
				e.stopPropagation()
			}
			void onSubmit()
			return
		}

		if (e.key === "Escape") {
			e.preventDefault()
			if (stopKeyboardPropagation) {
				e.stopPropagation()
			}
			onCancel()
		}
	}

	function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
		if (e.relatedTarget instanceof Node && wrapperRef.current?.contains(e.relatedTarget)) {
			return
		}

		if (value.trim()) {
			void onSubmit()
		} else {
			onCancel()
		}
	}

	return (
		<div className={cn("w-full", containerClassName)} data-testid={containerTestId}>
			<div ref={wrapperRef} className="flex items-center gap-1">
				<Input
					ref={inputRef}
					autoFocus
					data-testid={inputTestId}
					value={value}
					onChange={(e) => onValueChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					placeholder={placeholder}
					disabled={disabled}
					className={cn(
						"mr-1 bg-input/30 text-sm leading-5",
						SIZE_CLASS_MAP[size],
						inputClassName,
					)}
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					data-testid={submitButtonTestId}
					aria-label={submitButtonAriaLabel}
					disabled={disabled || !hasValue}
					onClick={() => {
						void onSubmit()
					}}
					className={cn("shadow-xs size-8 shrink-0 rounded-md", SIZE_CLASS_MAP[size])}
				>
					<Check className="h-4 w-4 text-[#22c55e]" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon"
					data-testid={cancelButtonTestId}
					aria-label={cancelButtonAriaLabel}
					disabled={disabled}
					onClick={onCancel}
					className={cn("shadow-xs size-8 shrink-0 rounded-md", SIZE_CLASS_MAP[size])}
				>
					<X className="h-4 w-4 text-[#ef4444]" />
				</Button>
			</div>
		</div>
	)
}

export default SidebarCreateInput
