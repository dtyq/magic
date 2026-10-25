import { forwardRef } from "react"
import { cn } from "@/utils/cn"

interface MaterialUploadTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	compact: boolean
	label: string
	hint?: string
}

const AttachmentIcon = ({ compact }: { compact: boolean }) => (
	<svg
		width={compact ? 12 : 18}
		height={compact ? 12 : 18}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={compact ? 2 : 1.5}
		className={compact ? undefined : "text-primary"}
		aria-hidden="true"
		data-testid="material-upload-trigger-svg"
	>
		{compact ? (
			<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
		) : (
			<>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</>
		)}
	</svg>
)

const MaterialUploadTrigger = forwardRef<HTMLButtonElement, MaterialUploadTriggerProps>(
	({ compact, label, hint, className, type = "button", ...props }, ref) => {
		if (compact) {
			return (
				<button
					ref={ref}
					type={type}
					className={cn(
						"inline-flex items-center gap-1 border-b border-dashed border-border/70 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
						className,
					)}
					data-testid="material-upload-trigger-button"
					{...props}
				>
					<AttachmentIcon compact />
					{label}
				</button>
			)
		}

		return (
			<button
				ref={ref}
				type={type}
				className={cn(
					"flex w-full cursor-pointer items-center justify-center border-b border-dashed border-zinc-950/15 bg-zinc-50/40 px-4 py-5 text-left transition-colors hover:bg-primary/[0.03] focus:border-primary/40 focus:outline-none",
					className,
				)}				data-testid="material-upload-trigger-button-2"

				{...props}
			>
				<span className="flex flex-col items-center gap-1.5 text-center">
					<span className="flex h-9 w-9 items-center justify-center bg-primary/10">
						<AttachmentIcon compact={false} />
					</span>
					<span className="text-sm font-medium text-foreground">{label}</span>
					{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
				</span>
			</button>
		)
	},
)

MaterialUploadTrigger.displayName = "MaterialUploadTrigger"

export default MaterialUploadTrigger
