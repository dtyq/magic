import type { ImgHTMLAttributes } from "react"
import type { FlowRouteType } from "@/types/flow"

/**
 * DefaultAvatar component props interface
 */
export interface DefaultAvatarProps extends Omit<
	ImgHTMLAttributes<HTMLImageElement>,
	"src" | "alt"
> {
	/** Flow route type to determine which default avatar to show */
	type?: FlowRouteType
	/** Custom CSS class name */
	className?: string
	/** Avatar size in pixels */
	size?: number
}
