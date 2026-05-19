import magicSystemFolderIcon from "../assets/magic-system-folder-icon.svg"

interface MagicSystemFolderIconProps {
	size?: number
	className?: string
}

export function MagicSystemFolderIcon({ size = 16, className }: MagicSystemFolderIconProps) {
	return (
		<img
			src={magicSystemFolderIcon as unknown as string}
			alt=""
			width={size}
			height={size}
			className={className ?? "block shrink-0"}
			aria-hidden
		/>
	)
}
