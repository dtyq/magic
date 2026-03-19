import { ServiceIcon } from "@dtyq/magic-admin"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProviderTypeIconProps {
	providerTypeId?: string | null
	className?: string
	size?: number
}

export function ProviderTypeIcon({ providerTypeId, className, size = 16 }: ProviderTypeIconProps) {
	const normalizedProviderTypeId = providerTypeId?.trim()

	if (normalizedProviderTypeId) {
		return (
			<span
				className={cn("inline-flex shrink-0 items-center justify-center", className)}
				style={{ width: size, height: size }}
			>
				<ServiceIcon code={normalizedProviderTypeId} size={size} />
			</span>
		)
	}

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground",
				className,
			)}
			style={{ width: size, height: size }}
		>
			<Sparkles size={Math.max(12, Math.round(size * 0.75))} />
		</span>
	)
}
