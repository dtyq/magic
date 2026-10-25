import type { PropsWithChildren } from "react"
import { TooltipProvider } from "../shadcn/tooltip"

export default function UIProvider(props: PropsWithChildren<unknown>) {
	const { children } = props

	return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
}
