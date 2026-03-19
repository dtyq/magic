import { useEffect, useState } from "react"
import type { LucideIcon, LucideProps } from "lucide-react"
import dynamicIconImports from "lucide-react/dynamicIconImports"

interface LucideIconModule {
	default: LucideIcon
}

const iconModules = dynamicIconImports as Record<string, () => Promise<LucideIconModule>>
const iconCache = new Map<string, LucideIcon>()
export const ALL_LUCIDE_ICON_KEBAB_NAMES = Object.keys(iconModules)

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

export async function loadLucideIconComponent(name?: string) {
	if (!name) return null

	const kebabName = toKebabCase(name)
	if (iconCache.has(kebabName)) return iconCache.get(kebabName) || null

	const loader = iconModules[kebabName]
	if (!loader) return null

	try {
		const mod = await loader()
		const IconComponent = mod?.default
		if (IconComponent) iconCache.set(kebabName, IconComponent)
		return IconComponent || null
	} catch {
		return null
	}
}

export function useLucideIcon(name?: string) {
	const [iconComponent, setIconComponent] = useState<LucideIcon | null>(null)

	useEffect(() => {
		let active = true
		if (!name) {
			setIconComponent(null)
			return () => {
				active = false
			}
		}

		loadLucideIconComponent(name).then((component) => {
			if (!active) return
			setIconComponent(component)
		})

		return () => {
			active = false
		}
	}, [name])

	return iconComponent
}

interface LucideLazyIconProps extends LucideProps {
	icon?: string
}

export function LucideLazyIcon({ icon, size = 16, ...rest }: LucideLazyIconProps) {
	const IconComponent = useLucideIcon(icon)
	if (!IconComponent) return null
	return <IconComponent size={size} {...rest} />
}
