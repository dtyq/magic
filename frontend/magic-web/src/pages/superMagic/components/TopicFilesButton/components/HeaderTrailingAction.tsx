import type { ReactNode } from "react"

interface HeaderTrailingActionProps {
	children: ReactNode
}

export default function HeaderTrailingAction({ children }: HeaderTrailingActionProps) {
	return <div className="flex shrink-0 items-center gap-1">{children}</div>
}
