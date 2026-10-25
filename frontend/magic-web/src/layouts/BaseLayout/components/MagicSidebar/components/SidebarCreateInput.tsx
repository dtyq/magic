import { Check, X } from "lucide-react"
import { useEffect, useRef } from "react"
import { Input } from "@/components/shadcn-ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/shadcn-ui/input-group"
import { cn } from "@/utils/cn"
import { shouldSuppressInputAutoFocusInMagicApp } from "@/utils/inputFocusPolicy"

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
	autoFocus?: boolean
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
	autoFocus = true,
	onValueChange,
	onSubmit,
	onCancel,
}: SidebarCreateInputProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const wrapperRef = useRef<HTMLDivElement>(null)
	const hasValue = Boolean(value.trim())
	const shouldAutoFocus = autoFocus && !shouldSuppressInputAutoFocusInMagicApp()

	useEffect(() => {
		if (!shouldAutoFocus) return undefined

		// Delay selection until the inline input has mounted so desktop users can type immediately.
		const timer = setTimeout(() => {
			inputRef.current?.focus()
			inputRef.current?.select()
		}, 50)

		return () => clearTimeout(timer)
	}, [shouldAutoFocus])

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
			<div ref={wrapperRef}>
				{/* 输入与操作共用边框，组内切换焦点仍由原失焦规则处理，避免挤占名称宽度。 */}
				<InputGroup
					className={cn(
						"bg-background shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-1",
						SIZE_CLASS_MAP[size],
					)}
				>
					<Input
						ref={inputRef}
						data-slot="input-group-control"
						autoFocus={shouldAutoFocus}
						data-testid={inputTestId}
						value={value}
						onChange={(e) => onValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={handleBlur}
						placeholder={placeholder}
						disabled={disabled}
						className={cn(
							"h-full flex-1 rounded-none border-0 bg-transparent px-2 text-sm leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent",
							inputClassName,
						)}
					/>
					<InputGroupAddon
						align="inline-end"
						className="shrink-0 gap-0 py-0 pr-1 has-[>button]:mr-0"
					>
						<InputGroupButton
							type="button"
							size="icon-xs"
							data-testid={submitButtonTestId}
							aria-label={submitButtonAriaLabel}
							disabled={disabled || !hasValue}
							onClick={() => {
								void onSubmit()
							}}
							className="text-muted-foreground hover:text-foreground focus-visible:ring-1"
						>
							<Check className="size-4" strokeWidth={1.5} />
						</InputGroupButton>
						<InputGroupButton
							type="button"
							size="icon-xs"
							data-testid={cancelButtonTestId}
							aria-label={cancelButtonAriaLabel}
							disabled={disabled}
							onClick={onCancel}
							className="text-muted-foreground hover:text-foreground focus-visible:ring-1"
						>
							<X className="size-4" strokeWidth={1.5} />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</div>
		</div>
	)
}

export default SidebarCreateInput
