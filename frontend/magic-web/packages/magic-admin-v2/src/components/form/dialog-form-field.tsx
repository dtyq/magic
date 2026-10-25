import { HelpCircle } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@magic-admin-v2/utils/cn"

export interface DialogFormFieldProps {
	children: ReactNode
	className?: string
	description?: string
	descriptionMode?: "tooltip" | "text"
	fieldId?: string
	label: ReactNode
	required?: boolean
	descriptionButtonTestId?: string
}

/** 弹窗表单统一的字段标题、必填标记和说明布局。 */
export function DialogFormField({
	children,
	className,
	description,
	descriptionMode = "tooltip",
	fieldId,
	label,
	required = false,
	descriptionButtonTestId,
}: DialogFormFieldProps) {
	return (
		<div className={cn("grid gap-2", className)} data-form-field={fieldId}>
			<div className="flex min-h-5 items-center gap-1.5">
				{fieldId ? (
					<label
						className="text-sm font-medium leading-5"
						htmlFor={fieldId}
						id={`${fieldId}-label`}
					>
						{label}
						{required ? <span className="ml-1 text-destructive">*</span> : null}
					</label>
				) : (
					<span className="text-sm font-medium leading-5">
						{label}
						{required ? <span className="ml-1 text-destructive">*</span> : null}
					</span>
				)}
				{description && descriptionMode === "tooltip" ? (
					<FieldDescriptionTooltip description={description} testId={descriptionButtonTestId} />
				) : null}
			</div>
			{children}
			{description && descriptionMode === "text" ? (
				<p className="text-xs text-muted-foreground">{description}</p>
			) : null}
		</div>
	)
}

function FieldDescriptionTooltip({ description, testId }: { description: string; testId?: string }) {
	return (
		<span className="group relative inline-flex">
			<button
				aria-label={description}
				data-testid={testId}
				className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				onMouseDown={(event) => event.preventDefault()}
				tabIndex={-1}
				type="button"
			>
				<HelpCircle className="size-3.5" aria-hidden="true" />
			</button>
			<span
				className="pointer-events-none absolute left-0 top-[calc(100%+0.375rem)] z-[120] hidden w-64 max-w-[calc(100vw-3rem)] rounded-md border bg-popover px-2.5 py-1.5 text-xs font-normal leading-5 text-popover-foreground shadow-md group-hover:block"
				role="tooltip"
			>
				{description}
			</span>
		</span>
	)
}
