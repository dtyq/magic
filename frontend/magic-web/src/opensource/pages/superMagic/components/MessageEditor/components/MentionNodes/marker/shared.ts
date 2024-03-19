import type { CanvasMarkerMentionData } from "@/opensource/components/business/MentionPanel/types"

export interface MarkerMentionStyleConfig {
	iconSize: number
	maxWidthClassName: string
	paddingClassName: string
	textClassName: string
	arrowSize: number
}

export function isCanvasMarkerMentionData(data: unknown): data is CanvasMarkerMentionData {
	return Boolean(data && typeof data === "object" && "data" in data)
}

export function getMarkerMentionStyleConfig({
	size,
	isMobile,
	iconSize,
}: {
	size?: string
	isMobile: boolean
	iconSize?: number
}): MarkerMentionStyleConfig {
	if (iconSize !== undefined) {
		return {
			iconSize,
			maxWidthClassName: iconSize >= 20 ? "max-w-[160px]" : "max-w-[148px]",
			paddingClassName: iconSize >= 16 ? "py-1" : "py-0.5",
			textClassName: "text-[10px] leading-[13px] md:text-xs md:leading-4",
			arrowSize: iconSize,
		}
	}

	if (isMobile || size === "small" || size === "mobile") {
		return {
			iconSize: 14,
			maxWidthClassName: "max-w-[148px]",
			paddingClassName: "py-0.5",
			textClassName: "text-[11px] leading-4 md:text-xs md:leading-4",
			arrowSize: 14,
		}
	}

	return {
		iconSize: 20,
		maxWidthClassName: "max-w-[180px]",
		paddingClassName: "py-1",
		textClassName: "text-[10px] leading-[13px] md:text-xs md:leading-4",
		arrowSize: 16,
	}
}
