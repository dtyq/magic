import type { MouseEvent, ReactNode } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { clipboard } from "@magic-admin-v2/utils/clipboard-helpers"
import { cn } from "@magic-admin-v2/utils/cn"

export type CopyableValueProps = {
	/** The raw value written to the clipboard. */
	value?: string | number | null
	/** Optional label rendered before the value. */
	label?: ReactNode
	/** Optional text used for the copy button's accessible name and tooltip. */
	copyLabel?: string
	/** Optional alternate display content; the raw value is still copied. */
	displayValue?: ReactNode
	/** Optional classes for the displayed value content. */
	contentClassName?: string
	/** Whether to render the copy icon alongside the value. */
	showIcon?: boolean
	/** Optional classes for the copy icon. */
	iconClassName?: string
	className?: string
	/** Optional stable selector for the copy button. */
	testId?: string
}

export function CopyableValue({
	className,
	copyLabel,
	contentClassName,
	displayValue,
	iconClassName,
	label,
	showIcon = true,
	testId,
	value,
}: CopyableValueProps) {
	const { t } = useTranslation()
	const rawValue = value === null || value === undefined ? "" : String(value)
	const resolvedCopyLabel = copyLabel || t("common.action.copy")
	const renderedValue = displayValue ?? rawValue

	async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()

		if (!rawValue) return

		try {
			await clipboard.writeText(rawValue)
			toast.success(t("common.message.copySuccess"))
		} catch {
			toast.error(t("common.message.copyFailed"))
		}
	}

	if (!rawValue) {
		return (
			<span className={cn("text-muted-foreground", className)}>
				{label ? <span>{label}: </span> : null}
				{displayValue ?? t("common.emptyValue")}
			</span>
		)
	}

	return (
		<button
			aria-label={resolvedCopyLabel}
			data-testid={testId}
			className={cn(
				"group inline-flex max-w-full cursor-pointer items-center gap-1 text-left font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
			onClick={handleCopy}
			title={resolvedCopyLabel}
			type="button"
		>
			<span className={cn("truncate", contentClassName)}>
				{label ? <span>{label}: </span> : null}
				{renderedValue}
			</span>
			{showIcon ? (
				<Copy
					className={cn(
						"size-3.5 shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100",
						iconClassName,
					)}
					aria-hidden="true"
				/>
			) : null}
		</button>
	)
}
