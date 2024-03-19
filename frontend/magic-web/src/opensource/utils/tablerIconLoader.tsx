import { useEffect, useState } from "react"
import type * as React from "react"
import type { IconProps } from "@tabler/icons-react"

interface TablerIconModule {
	[key: string]: unknown
}

type TablerIconComponent = React.ComponentType<IconProps> | React.ExoticComponent<IconProps>

const iconCache = new Map<string, TablerIconComponent>()
let iconModulePromise: Promise<TablerIconModule> | null = null

async function loadTablerIconModule() {
	if (!iconModulePromise)
		iconModulePromise = import("@tabler/icons-react") as Promise<TablerIconModule>

	return iconModulePromise
}

function isTablerIconComponent(value: unknown): value is TablerIconComponent {
	return typeof value === "function" || (typeof value === "object" && value !== null)
}

export async function loadTablerIconComponent(name?: string) {
	if (!name) return null
	if (iconCache.has(name)) return iconCache.get(name) || null

	try {
		const iconModule = await loadTablerIconModule()
		const IconComponent = iconModule[name]
		if (!isTablerIconComponent(IconComponent)) return null

		iconCache.set(name, IconComponent)
		return IconComponent
	} catch {
		return null
	}
}

export function useTablerIcon(name?: string) {
	const [iconComponent, setIconComponent] = useState<TablerIconComponent | null>(null)

	useEffect(() => {
		let active = true
		if (!name) {
			setIconComponent(null)
			return () => {
				active = false
			}
		}

		if (iconCache.has(name)) {
			setIconComponent(iconCache.get(name) || null)
			return () => {
				active = false
			}
		}

		setIconComponent(null)

		loadTablerIconComponent(name).then((component) => {
			if (!active) return
			setIconComponent(component)
		})

		return () => {
			active = false
		}
	}, [name])

	return iconComponent
}

interface TablerIconProps extends IconProps {
	name?: string
}

export function TablerIcon({ name, size = 24, color, stroke = 1.5, ...rest }: TablerIconProps) {
	const IconComponent = useTablerIcon(name)
	if (!IconComponent) return null
	return <IconComponent size={size} color={color} stroke={stroke} {...rest} />
}
