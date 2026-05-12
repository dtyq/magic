import type { LucideProps } from "lucide-react"
import { DynamicIcon, iconNames } from "lucide-react/dynamic"
import type { IconName } from "lucide-react/dynamic"

const validIconNames = new Set<string>(iconNames)
export const ALL_LUCIDE_ICON_KEBAB_NAMES = [...iconNames]

/**
 * Convert icon name from PascalCase/camelCase to kebab-case
 * Example: "Presentation" -> "presentation", "ChevronRight" -> "chevron-right"
 */
export function toKebabCase(name: string): string {
	if (!name) return ""

	// Handle already kebab-case names
	if (name.includes("-")) return name.toLowerCase()

	// Convert PascalCase/camelCase to kebab-case
	return name
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase()
}

function normalizeIconName(name?: string): IconName | null {
	if (!name) return null

	const kebabName = toKebabCase(name)
	if (!validIconNames.has(kebabName)) return null

	return kebabName as IconName
}

interface LucideLazyIconProps extends Omit<LucideProps, "name"> {
	icon?: string
	fallbackIcon?: string
}

export function LucideLazyIcon({ icon, fallbackIcon, size = 16, ...rest }: LucideLazyIconProps) {
	const iconName = normalizeIconName(icon) ?? normalizeIconName(fallbackIcon)
	if (!iconName) return null

	return <DynamicIcon {...rest} name={iconName} size={size} />
}
