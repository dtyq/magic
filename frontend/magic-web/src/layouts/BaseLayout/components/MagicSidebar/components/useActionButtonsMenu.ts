import type { LucideIcon } from "lucide-react"
import { useMemo } from "react"

type ActionButtonItem = {
	id: string
	label: string
	icon: LucideIcon
	onClick: () => void
}

export function useActionButtonsMenu(): ActionButtonItem[] {
	return useMemo<ActionButtonItem[]>(() => [], [])
}
