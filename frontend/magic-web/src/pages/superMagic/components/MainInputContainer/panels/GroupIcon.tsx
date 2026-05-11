import { LucideLazyIcon } from "@/utils/lucideIconLoader"

interface GroupIconProps {
	icon: string
	className?: string
}

/**
 * Dynamically render Lucide React icon by component name
 * Fallback to LayoutTemplate if icon not found
 */
function GroupIcon({ icon, className = "size-6" }: GroupIconProps) {
	return <LucideLazyIcon icon={icon} fallbackIcon="LayoutTemplate" className={className} />
}

export default GroupIcon
