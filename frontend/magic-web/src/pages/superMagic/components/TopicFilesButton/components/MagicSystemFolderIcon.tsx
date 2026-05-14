import magicSystemFolderIcon from "../assets/magic-system-folder-icon.svg"

interface MagicSystemFolderIconProps {
	size?: number
	className?: string
	dataTestId?: string
}

/**
 * 统一封装 `.magic` 系统目录图标，避免业务组件重复处理尺寸和资源地址。
 */
export function MagicSystemFolderIcon({
	size = 16,
	className,
	dataTestId,
}: MagicSystemFolderIconProps) {
	return (
		<img
			src={magicSystemFolderIcon as unknown as string}
			alt=""
			width={size}
			height={size}
			className={className ?? "block shrink-0"}
			data-testid={dataTestId}
			aria-hidden
		/>
	)
}
