import { memo } from "react"
import { getToolIconConfig } from "./config"
import type { ToolIconBadgeProps } from "./types"

function ToolIconBadge({ toolName, size = 16, iconSize = 12, className = "" }: ToolIconBadgeProps) {
	const config = getToolIconConfig(toolName)
	const IconComponent = config.icon

	return (
		<span
			className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-sm ${className}`}
			style={{
				backgroundColor: config.assetUrl ? "transparent" : config.bgColor,
				width: `${size}px`,
				height: `${size}px`,
			}}
		>
			{config.assetUrl ? (
				<img
					src={config.assetUrl}
					alt=""
					width={size}
					height={size}
					className="block max-h-full max-w-full object-contain"
					aria-hidden
				/>
			) : (
				<IconComponent
					size={iconSize}
					strokeWidth={2}
					className="text-white"
					// Button 的 SVG 默认尺寸会覆盖 size 属性；显式保留色块内部留白。
					style={{ width: iconSize, height: iconSize }}
				/>
			)}
		</span>
	)
}

export default memo(ToolIconBadge)
