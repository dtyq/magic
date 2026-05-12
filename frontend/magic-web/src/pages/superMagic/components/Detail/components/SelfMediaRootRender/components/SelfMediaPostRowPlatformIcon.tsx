import { memo, useId } from "react"
import { cn } from "@/lib/utils"
import type { SelfMediaPlatform } from "../../../types"
import { SelfMediaPlatformIconPaths } from "./selfMediaPlatformIconPaths"

export interface SelfMediaPostRowPlatformIconProps {
	platform: SelfMediaPlatform
	/** File tree row uses 16; switcher uses 14 */
	size?: 16 | 14
	className?: string
}

/** Same platform glyph as the switcher; only pixel size may differ. */
function SelfMediaPostRowPlatformIcon({
	platform,
	size = 16,
	className,
}: SelfMediaPostRowPlatformIconProps) {
	const gradId = useId().replace(/:/g, "")

	return (
		<span
			className={cn("inline-flex shrink-0 items-center justify-center", className)}
			aria-hidden
			data-testid={`self-media-post-row-icon-${platform}`}
		>
			<svg
				role="img"
				width={size}
				height={size}
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

export default memo(SelfMediaPostRowPlatformIcon)
