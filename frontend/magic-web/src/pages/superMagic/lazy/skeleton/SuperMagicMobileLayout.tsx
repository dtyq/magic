import { type PropsWithChildren, type ReactNode } from "react"
import { observer } from "mobx-react-lite"

interface SuperMagicMobileLayoutSkeletonProps extends PropsWithChildren {
	header?: ReactNode
}

/**
 * Lightweight layout wrapper for route sketches; mirrors SuperMagicMobileLayout flex structure.
 */
function SuperMagicMobileLayoutSkeleton({ header, children }: SuperMagicMobileLayoutSkeletonProps) {
	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
			{header}
			<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
		</div>
	)
}

export default observer(SuperMagicMobileLayoutSkeleton)
