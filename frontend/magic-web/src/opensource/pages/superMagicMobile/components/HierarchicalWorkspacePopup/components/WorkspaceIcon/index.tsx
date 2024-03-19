import { Box } from "lucide-react"
import { memo } from "react"

function WorkspaceIcon() {
	return (
		<div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground">
			<Box className="size-4 text-background" />
		</div>
	)
}

export default memo(WorkspaceIcon)
