import { useEffect, useState } from "react"
import type { IconProps } from "@tabler/icons-react"

const iconCache = new Map<string, React.ComponentType<IconProps>>()

export async function loadTablerIconComponent(name?: string) {
	if (!name) return null
	if (iconCache.has(name)) return iconCache.get(name) || null

	try {
		const mod = await import("@tabler/icons-react")
		const IconComponent = (mod as Record<string, unknown>)[name] as
			| React.ComponentType<IconProps>
			| undefined
		if (IconComponent) iconCache.set(name, IconComponent)
		return IconComponent || null
	} catch {
		return null
	}
}

export function useTablerIcon(name?: string) {
	const [iconComponent, setIconComponent] = useState<React.ComponentType<IconProps> | null>(null)

	useEffect(() => {
		let active = true
		if (!name) {
			setIconComponent(null)
			return () => {
				active = false
			}
		}

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
	// 返回一个占位符而不是null，避免suspense错误
	if (!IconComponent) {
		return <span style={{ display: "inline-block", width: size, height: size }} />
	}
	return <IconComponent size={size} color={color} stroke={stroke} {...rest} />
}
