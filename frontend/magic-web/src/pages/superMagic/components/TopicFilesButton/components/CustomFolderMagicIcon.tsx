import MagicFileIcon from "@/components/base/MagicFileIcon"
import { memo } from "react"
import { useCustomFolderIconUrl } from "../hooks/useCustomFolderIconUrl"

interface CustomFolderMagicIconProps {
	displayConfig?: any
	/** 用于解析 icon 的「custom 文件夹根」下子树：目录为自身 children，入口文件为父目录 children */
	childrenItems?: unknown[]
	typeFallback?: string
	size?: number
	className?: string
}

/** custom metadata（目录或合并了文件夹 metadata 的入口文件）：优先 icon（相对路径 / http(s) / data URL），失败回退 typeFallback */
export const CustomFolderMagicIcon = memo(function CustomFolderMagicIcon({
	displayConfig,
	childrenItems,
	typeFallback,
	size = 16,
	className,
}: CustomFolderMagicIconProps) {
	const remoteIconUrl = useCustomFolderIconUrl({ displayConfig, children: childrenItems })

	return (
		<MagicFileIcon
			type={typeFallback}
			remoteIconUrl={remoteIconUrl}
			size={size}
			className={className}
		/>
	)
})
