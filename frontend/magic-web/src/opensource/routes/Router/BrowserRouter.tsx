import { useLayoutEffect, useState } from "react"
import { Router } from "react-router"
import type { ReactNode } from "react"
import { baseHistory } from "../history"

export interface BrowserRouterProps {
	basename?: string
	children?: ReactNode
	window?: Window
}

export function BrowserRouter({ basename, children }: BrowserRouterProps) {
	const [state, setState] = useState({
		action: baseHistory.action,
		location: baseHistory.location,
	})

	useLayoutEffect(() => baseHistory.listen(setState), [])

	return (
		<Router
			basename={basename}
			location={state.location}
			navigationType={state.action}
			navigator={baseHistory}
		>
			{children}
		</Router>
	)
}
