import { lazy, Suspense } from "react"
import type { MCPButtonProps } from "./MCPButton"

const BaseMCPButton = lazy(() => import("./MCPButton"))

export default function MCPButton(props: MCPButtonProps) {
	return (
		<Suspense>
			<BaseMCPButton {...props} />
		</Suspense>
	)
}
