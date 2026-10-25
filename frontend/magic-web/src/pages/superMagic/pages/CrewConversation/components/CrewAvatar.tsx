import { useState } from "react"
import { cn } from "@/utils/cn"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"

interface CrewAvatarProps {
	src?: string | null
	name?: string
	className?: string
}

export default function CrewAvatar({ src, name, className }: CrewAvatarProps) {
	const [loadFailed, setLoadFailed] = useState(false)
	const showImage = Boolean(src) && !loadFailed

	return (
		<div
			className={cn(
				"flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
				className,
			)}
			aria-hidden
		>
			{showImage ? (
				<img
					src={src ?? ""}
					alt={name ?? ""}
					className="h-full w-full object-cover"
					onError={() => setLoadFailed(true)}
					data-testid="set-load-failed"
				/>
			) : (
				<CrewFallbackAvatar iconSize={28} />
			)}
		</div>
	)
}
