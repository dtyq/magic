import * as LucideIcons from "lucide-react"

interface GroupIconProps {
	icon: string
	className?: string
}

/**
 * Dynamically render Lucide React icon by component name
 * Fallback to LayoutTemplate if icon not found
 */
function GroupIcon({ icon, className = "size-6" }: GroupIconProps) {
	const IconComponent =
		(LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{
			className?: string
		}>) || LucideIcons.LayoutTemplate

	return <IconComponent className={className} />
}

export default GroupIcon
