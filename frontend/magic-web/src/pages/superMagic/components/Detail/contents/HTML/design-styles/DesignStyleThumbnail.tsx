import { memo } from "react"
import type { DesignStyle } from "./catalog"
import { getDesignStylePreviewUrl } from "./DesignStyleHtmlPreview"

interface DesignStyleThumbnailProps {
	style: DesignStyle
}

/** A 16:10 cover that uses the same static document as the full preview. */
export default memo(function DesignStyleThumbnail({ style }: DesignStyleThumbnailProps) {
	return (
		<div
			data-testid={`design-style-thumbnail-${style.code}`}
			// Keep the cover compact while letting the document choose its own responsive layout.
			className="aspect-[8/5] overflow-hidden border-b border-border/50 bg-muted/30"
			aria-hidden="true"
		>
			<iframe
				title={`${style.title} preview`}
				sandbox=""
				src={getDesignStylePreviewUrl(style.code)}
				loading="lazy"
				className="pointer-events-none block border-0 bg-background"
				style={{
					width: "285.714%",
					height: "285.714%",
					transform: "scale(0.35)",
					transformOrigin: "top left",
				}}
				tabIndex={-1}
			/>
		</div>
	)
})
