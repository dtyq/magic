import type { ReactNode } from "react"

export function PlatformInfoFieldControl({
	children,
	error,
}: {
	children: ReactNode
	error?: string
}) {
	return (
		<div className="grid gap-1.5">
			{children}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	)
}
