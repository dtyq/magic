import { memo, useId } from "react"
import { cn } from "@/lib/utils"
import type { SelfMediaPlatform } from "../../../types"
import { SelfMediaPlatformIconPaths } from "./selfMediaPlatformIconPaths"

export interface PlatformBrandIconProps {
	platform: SelfMediaPlatform
	className?: string
}

/** Branded 16px glyph per platform; keeps colors minimal for the switcher. */
function PlatformBrandIcon({ platform, className }: PlatformBrandIconProps) {
	const gradId = useId().replace(/:/g, "")

	return (
		<span
			className={cn("inline-flex size-3.5 shrink-0 items-center justify-center", className)}
			aria-hidden
		>
			<svg
				role="img"
				width={14}
				height={14}
				viewBox="0 0 24 24"
				className="shrink-0"
				aria-hidden
			>
				<SelfMediaPlatformIconPaths
					platform={platform}
					instagramGradientId={`ig-${gradId}`}
				/>
			</svg>
		</span>
	)
}

export default memo(PlatformBrandIcon)
