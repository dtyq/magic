import { useState, useCallback, useEffect } from "react"
import { PencilLine } from "lucide-react"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import { cn } from "@/opensource/lib/tiptap-utils"

/** Card-native inline editable field - no input box, writes directly onto the card */
export interface InlineEditFieldProps {
	value: string
	placeholder: string
	/** Tailwind classes for the display <span> and transparent input */
	textClassName: string
	displayTextClassName?: string
	displayTooltipContent?: string
	multiline?: boolean
	multilineRows?: number
	align?: "center" | "left"
	onSave: (val: string) => void
	testId?: string
	maxLength?: number
	disabled?: boolean
	onClick?: () => void
}

/**
 * Shared container shape - border-b is always present (transparent) so
 * switching to edit state never adds height.
 */
const CONTAINER_BASE =
	"group relative flex w-full items-start justify-center p-1 border-b transition-colors duration-150 px-5"

export function InlineEditField({
	value,
	placeholder,
	textClassName,
	displayTextClassName,
	displayTooltipContent,
	multiline = false,
	multilineRows = 2,
	align = "center",
	onSave,
	testId,
	maxLength,
	disabled = false,
	onClick,
}: InlineEditFieldProps) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(value)

	useEffect(() => {
		if (disabled) setEditing(false)
	}, [disabled])

	const startEdit = useCallback(() => {
		if (disabled) return
		if (onClick) {
			onClick()
			return
		}
		setDraft(value)
		setEditing(true)
	}, [disabled, onClick, value])

	const commit = useCallback(() => {
		onSave(draft.trim())
		setEditing(false)
	}, [draft, onSave])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !multiline) {
				e.preventDefault()
				commit()
			}
			if (e.key === "Escape") setEditing(false)
		},
		[commit, multiline],
	)

	const alignClass = align === "center" ? "text-center" : "text-left"

	const inputClass = cn(
		"w-full min-w-0 bg-transparent text-foreground caret-primary focus:outline-none",
		alignClass,
		textClassName,
	)

	const draftLength = draft.length
	const isNearLimit = maxLength !== undefined && draftLength >= Math.ceil(maxLength * 0.85)

	if (editing) {
		return (
			<div className="relative w-full">
				<div
					className={cn(
						CONTAINER_BASE,
						"flex-col border-border focus-within:border-primary/60",
					)}
				>
					{multiline ? (
						<textarea
							autoFocus
							value={draft}
							rows={multilineRows}
							onChange={(e) => setDraft(e.target.value)}
							onBlur={commit}
							onKeyDown={handleKeyDown}
							className={cn(inputClass, "resize-none overflow-auto leading-relaxed")}
							data-testid={testId}
							maxLength={maxLength}
						/>
					) : (
						<input
							autoFocus
							type="text"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onBlur={commit}
							onKeyDown={handleKeyDown}
							className={cn(inputClass, "overflow-hidden")}
							data-testid={testId}
							maxLength={maxLength}
						/>
					)}
				</div>
				{draftLength !== undefined && (
					<span
						className={cn(
							"absolute -bottom-4 right-0",
							"mt-0.5 self-end text-[10px] tabular-nums transition-colors",
							isNearLimit ? "text-destructive" : "text-muted-foreground/60",
						)}
					>
						{draftLength} / {maxLength}
					</span>
				)}
			</div>
		)
	}

	const displayTextClasses = cn(
		"min-w-0 flex-1 transition-colors",
		alignClass,
		textClassName,
		displayTextClassName,
		multiline ? "whitespace-pre-wrap break-words" : "truncate",
		value ? "text-foreground" : "text-muted-foreground",
	)

	return (
		<button
			type="button"
			className={cn(
				CONTAINER_BASE,
				"rounded-sm border-transparent",
				disabled ? "cursor-default" : "hover:bg-accent/60",
			)}
			onClick={startEdit}
			disabled={disabled}
			data-testid={testId}
		>
			{displayTooltipContent ? (
				<SmartTooltip
					elementType="span"
					className={cn("block", displayTextClasses)}
					content={displayTooltipContent}
					sideOffset={4}
				>
					{value || placeholder}
				</SmartTooltip>
			) : (
				<span className={displayTextClasses}>{value || placeholder}</span>
			)}
			{disabled ? null : (
				<PencilLine className="absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
			)}
		</button>
	)
}
