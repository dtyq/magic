import { memo } from "react"
import { IconExclamationCircleFilled } from "@tabler/icons-react"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/utils/cn"

export type OptimisticStatus = "sending" | "failed"

interface OptimisticStatusIndicatorProps {
	status?: OptimisticStatus
	onRetry?: () => void
}

const baseClassName = cn(
	"flex size-5 flex-none items-center justify-center rounded-full",
	"bg-transparent text-muted-foreground",
)

/** Displays local send status for user messages; failed state only exposes a retry entry, no message data is stored. */
const OptimisticStatusIndicator = memo(({ status, onRetry }: OptimisticStatusIndicatorProps) => {
	if (!status) return null

	if (status === "sending") {
		return (
			<div className={baseClassName}>
				<Spinner className="animate-spin" size={18} />
			</div>
		)
	}

	return (
		<button
			type="button"
			className={cn(
				baseClassName,
				"cursor-pointer border-0 p-0 text-destructive/80 transition-colors hover:text-destructive",
			)}
			onClick={onRetry}
			data-testid="on-retry"
		>
			<IconExclamationCircleFilled size={20} />
		</button>
	)
})

OptimisticStatusIndicator.displayName = "OptimisticStatusIndicator"

export default OptimisticStatusIndicator
