import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { memo } from "react"

function SpinnerComponent({
	className,
	size = 16,
	...props
}: React.ComponentProps<"svg"> & { size?: number }) {
	return (
		<Loader2Icon
			role="status"
			aria-label="Loading"
			className={cn("size-animate-spin", className)}
			size={size}
			{...props}
		/>
	)
}

const Spinner = memo(SpinnerComponent)

export { Spinner }
