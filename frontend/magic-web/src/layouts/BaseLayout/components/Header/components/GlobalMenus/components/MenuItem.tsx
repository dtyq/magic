import type { CSSProperties } from "react"

import MagicBadge from "@/components/base/MagicBadge"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"

interface MenuItemProps {
	icon: string
	label: string
	color?: string
	maskColor?: string
	badge?: "dot" | number | false
	onClick?: () => void
}

function MenuItem({ icon, label, color, maskColor, badge = false, onClick }: MenuItemProps) {
	const iconElement = (
		<div
			className="relative z-[1] mb-1 flex items-center justify-center after:absolute after:left-0 after:top-0 after:-z-[1] after:size-6 after:translate-x-2 after:translate-y-2 after:rounded-full after:bg-[var(--mask-color)] after:content-['']"
			style={{ color, "--mask-color": maskColor } as CSSProperties}
		>
			<LucideLazyIcon icon={icon} size="32" color={color} />
		</div>
	)

	const badgedIcon = badge ? (
		<MagicBadge count={typeof badge === "number" ? badge : undefined} dot={badge === "dot"}>
			{iconElement}
		</MagicBadge>
	) : (
		iconElement
	)

	return (
		<button
			type="button"
			className="ease-[ease] flex cursor-pointer flex-col items-center rounded-lg px-2 py-3 text-inherit no-underline transition-all duration-200 hover:bg-[var(--magic-color-fill-tertiary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:scale-95"
			onClick={onClick}
		>
			{badgedIcon}
			<span className="text-center text-sm font-normal not-italic leading-5 text-foreground/80">
				{label}
			</span>
		</button>
	)
}

export default MenuItem
