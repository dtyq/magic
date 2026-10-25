import { cn } from "@/utils/cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="skeleton" className={cn("skeleton rounded-md", className)} {...props} />
}

export { Skeleton }
