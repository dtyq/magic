import type { PropsWithChildren } from "react"
import { TooltipProvider } from "../tooltip"

export default function UIProvider(props: PropsWithChildren<unknown>) {
	const { children } = props

	return <TooltipProvider>{children}</TooltipProvider>
}
