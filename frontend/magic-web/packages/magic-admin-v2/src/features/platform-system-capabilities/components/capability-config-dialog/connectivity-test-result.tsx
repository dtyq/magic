import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"

export type ConnectivityTestState =
	| { status: "idle" }
	| { status: "testing" }
	| { status: "success"; durationMs?: number; message?: string }
	| { status: "error"; durationMs?: number; message: string }

export function ConnectivityTestResult({
	result,
	labels,
}: {
	result: ConnectivityTestState
	labels: {
		normal: string
		error: string
		viewDetails: string
		hideDetails: string
		failureDescription: string
		duration: (durationMs: number) => string
	}
}) {
	const [showDetails, setShowDetails] = useState(true)

	if (result.status === "idle" || result.status === "testing") return null

	const isError = result.status === "error"
	const message = result.message?.trim()

	return (
		<div
			className={cn(
				"rounded-md border p-4",
				isError
					? "border-destructive/20 bg-destructive/5"
					: "border-emerald-200 bg-emerald-50",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div
					className={cn(
						"flex items-center gap-2 text-sm font-medium",
						isError ? "text-destructive" : "text-emerald-700",
					)}
				>
					{isError ? (
						<XCircle className="size-4 shrink-0" aria-hidden="true" />
					) : (
						<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
					)}
					<span>{isError ? labels.error : labels.normal}</span>
				</div>
				{isError && message ? (
					<Button
						aria-expanded={showDetails}
						className="h-auto shrink-0 gap-1 px-0 py-0 text-xs text-destructive"
						onClick={() => setShowDetails((value) => !value)}
						type="button"
						variant="link"
					 data-testid="platform-system-capabilities-view-button">
						{showDetails ? labels.hideDetails : labels.viewDetails}
						{showDetails ? (
							<ChevronUp className="size-3.5" aria-hidden="true" />
						) : (
							<ChevronDown className="size-3.5" aria-hidden="true" />
						)}
					</Button>
				) : null}
			</div>
			{!isError || showDetails ? (
				<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
					{result.durationMs !== undefined ? (
						<div>{labels.duration(result.durationMs)}</div>
					) : null}
					{isError ? (
						<div>{labels.failureDescription}</div>
					) : message ? (
						<div>{message}</div>
					) : null}
					{isError && message ? (
						<pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-xs text-foreground">
							{message}
						</pre>
					) : null}
				</div>
			) : null}
		</div>
	)
}
